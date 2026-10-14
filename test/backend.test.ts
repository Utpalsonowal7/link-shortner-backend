import { unlink } from "node:fs/promises";
import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import type { AddressInfo } from "node:net";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import type { Link, User } from "../generated/prisma/client.js";

Object.assign(process.env, {
    NODE_ENV: "test",
    CORS_ORIGIN: "https://frontend.example",
    FRONTEND_URL: "https://frontend.example",
    BACK_END_URL: "https://short.example/",
    ACCESS_TOKEN_SECRET: "test-access-secret-do-not-use-in-production",
    REFRESH_TOKEN_SECRET: "test-refresh-secret-do-not-use-in-production",
    ACCESS_TOKEN_EXPIRES_IN: "15m",
    REFRESH_TOKEN_EXPIRES_IN: "30d",
    RAZORPAY_KEY_ID: "test-key",
    RAZORPAY_KEY_SECRET: "test-secret",
});

const timestamp = new Date("2026-01-01T00:00:00Z");
const passwordHash = await bcrypt.hash("Password123!", 4);
const user: User = {
    id: 1, name: "Test User", email: "user@example.test", password: passwordHash,
    isEmailVerified: true, provider: "EMAIL", providerId: null, role: "USER",
    avatar: null, createdAt: timestamp, updatedAt: timestamp,
};
function linkFixture(overrides: Partial<Link> = {}): Link {
    return {
        id: 10, userId: 1, shortCode: "normal", longUrl: "https://destination.example/page",
        title: "Example", qrUrl: null, domainId: null, password: null,
        is_password_protected: false, utmSource: "newsletter", utmMedium: null,
        utmCampaign: null, utmTerm: null, utmContent: null, createdAt: timestamp,
        updatedAt: timestamp, expiresAt: null, isActive: true, tags: [], totalClicks: 0,
        ...overrides,
    };
}
let links: Link[] = [];
let tracked: number[] = [];
let updates: { id: number; userId?: number }[] = [];
let listing: { skip?: number; take?: number; where: { userId: number } } | undefined;

const database = {
    user: {
        findUnique: async ({ where }: { where: { email?: string } }) => where.email === user.email ? user : null,
    },
    link: {
        findUnique: async ({ where }: { where: { shortCode?: string; id?: number } }) =>
            links.find(link => where.shortCode ? link.shortCode === where.shortCode : link.id === where.id) ?? null,
        create: async ({ data }: { data: Partial<Link> }) => {
            const created = linkFixture({ ...data, id: 99 });
            links.push(created);
            return created;
        },
        update: async ({ where, data }: {
            where: { id: number; userId?: number };
            data: { password?: string; is_password_protected?: boolean; totalClicks?: { increment: number } };
        }) => {
            updates.push(where);
            const link = links.find(link => link.id === where.id && (where.userId === undefined || link.userId === where.userId));
            if (!link) throw new PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "7.8.0" });
            if (data.password) link.password = data.password;
            if (data.is_password_protected !== undefined) link.is_password_protected = data.is_password_protected;
            if (data.totalClicks) link.totalClicks += data.totalClicks.increment;
            return link;
        },
        findMany: async (args: { skip?: number; take?: number; where: { userId: number }; omit?: { password: boolean } }) => {
            listing = args;
            return links.filter(link => link.userId === args.where.userId).map(({ password: _password, ...link }) => link);
        },
        count: async ({ where }: { where: { userId: number } }) => links.filter(link => link.userId === where.userId).length,
    },
    clickEvent: {
        create: async ({ data }: { data: { linkId: number } }) => { tracked.push(data.linkId); return data; },
    },
    session: { findUnique: async () => null, create: async () => ({ id: 1 }) },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
};
const compiled = (path: string) => new URL(`../dist/src/${path}`, import.meta.url);
mock.module(compiled("lib/db.js"), { namedExports: { prisma: database } });
mock.module(compiled("lib/redis.js"), { namedExports: { client: { get: async () => null, setex: async () => "OK", del: async () => 1 } } });
mock.module(compiled("lib/queqe.js"), { namedExports: { emailQueue: { add: async () => ({ id: "test-job" }) } } });
mock.module(compiled("services/geo.service.js"), { namedExports: { getClientGeoInfo: async () => ({ country: "India" }) } });
mock.module(compiled("services/cloudinary.js"), { namedExports: { cloudUpload: async (path: string) => { await unlink(path); return { url: "https://images.example/qr.png" }; } } });
mock.module(compiled("utils/logger.js"), { defaultExport: { info: () => undefined } });

const { default: app }: typeof import("../src/app.js") = await import(compiled("app.js").href);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
after(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    mock.restoreAll();
});

beforeEach(() => {
    tracked = []; updates = []; listing = undefined;
    links = [
        linkFixture(),
        linkFixture({ id: 11, shortCode: "protected", password: passwordHash, is_password_protected: true }),
        linkFixture({ id: 12, shortCode: "expired", expiresAt: timestamp }),
        linkFixture({ id: 13, shortCode: "inactive", isActive: false }),
        linkFixture({ id: 14, shortCode: "someoneelse", userId: 2 }),
    ];
});
function request(path: string, options: RequestInit = {}, authenticated = false) {
    const headers = new Headers(options.headers);
    if (authenticated) headers.set("authorization", `Bearer ${jwt.sign({ id: user.id, name: user.name, email: user.email }, process.env.ACCESS_TOKEN_SECRET!)}`);
    return fetch(`${baseUrl}${path}`, { ...options, headers, redirect: "manual", signal: AbortSignal.timeout(5000) });
}
function jsonBody(body: unknown): RequestInit {
    return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

test("compiled app serves the existing health route with CORS", async () => {
    const response = await request("/health-check", { headers: { origin: "https://frontend.example" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://frontend.example");
    assert.equal((await response.json()).success, true);
});

test("private routes reject requests without authentication", async () => {
    assert.equal((await request("/api/v1/links")).status, 401);
});

test("JWT payloads without an email are rejected", async () => {
    const token = jwt.sign("invalid-payload", process.env.ACCESS_TOKEN_SECRET!);
    assert.equal((await request("/api/v1/links", { headers: { authorization: `Bearer ${token}` } })).status, 401);
});

test("link creation keeps the existing API response and hashes the password", async () => {
    const response = await request("/api/v1/links", jsonBody({ longUrl: "https://example.test", customCode: "created", password: "secret123" }), true);
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.deepEqual(body.data, { longUrl: "https://example.test", shortLink: "https://short.example/created" });
    const created = links.find(link => link.shortCode === "created")!;
    assert.equal(created.userId, user.id);
    assert.equal(await bcrypt.compare("secret123", created.password!), true);
});

test("link creation rejects unsafe URL protocols", async () => {
    const response = await request("/api/v1/links", jsonBody({ longUrl: "javascript:alert(1)" }), true);
    assert.equal(response.status, 422);
    assert.equal(links.length, 5);
});

test("link listing uses parsed pagination and returns only the user's records", async () => {
    const response = await request("/api/v1/links?page=2&limit=2", {}, true);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.pagination, { page: 2, limit: 2, total: 4, totalPages: 2 });
    assert.equal(listing?.skip, 2);
    assert.equal(listing?.take, 2);
    assert.equal(listing?.where.userId, 1);
    assert.ok(body.data.links.every((link: { userId: number; password?: unknown }) => link.userId === 1 && !("password" in link)));
});

test("normal links redirect with UTM parameters and record a click", async () => {
    const response = await request("/normal");
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://destination.example/page?utm_source=newsletter");
    assert.deepEqual(tracked, [10]);
});

test("protected links use the existing frontend password screen", async () => {
    const response = await request("/protected");
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://frontend.example/protectedlink?q=protected");
    assert.deepEqual(tracked, []);
});

test("expired links use the existing expiration screen", async () => {
    const response = await request("/expired");
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://frontend.example/link-expired");
});

test("missing and inactive links finish with an error response", async () => {
    assert.equal((await request("/missing")).status, 404);
    assert.equal((await request("/inactive")).status, 410);
});

test("password verification rejects a wrong password and accepts the right one", async () => {
    assert.equal((await request("/api/v1/links/verify", jsonBody({ q: "protected", password: "wrong" }))).status, 400);
    const response = await request("/api/v1/links/verify", jsonBody({ q: "protected", password: "Password123!" }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data, "https://destination.example/page");
});

test("password editing is scoped to the signed-in owner", async () => {
    const foreign = await request("/api/v1/links/14", jsonBody({ password: "newsecret" }), true);
    assert.equal(foreign.status, 400);
    assert.equal(links.find(link => link.id === 14)?.password, null);
    assert.deepEqual(updates[0], { id: 14, userId: 1 });
    assert.equal((await request("/api/v1/links/10", jsonBody({ password: "newsecret" }), true)).status, 200);
    assert.equal(await bcrypt.compare("newsecret", links[0].password!), true);
});

test("array query values are rejected before reaching analytics or OAuth", async () => {
    assert.equal((await request("/api/v1/links/10?range=7&range=30", {}, true)).status, 400);
    assert.equal((await request("/api/v1/auth/google/callback?code=one&code=two")).status, 400);
});

test("QR uploads report a missing file without crashing", async () => {
    const response = await request("/api/v1/qr/qr-generate", jsonBody({ form: JSON.stringify({ longUrl: "https://example.test" }) }), true);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).message, "QR image is required");
});

test("login preserves access and refresh cookies and user response", async () => {
    const response = await request("/api/v1/auth/login", jsonBody({ email: user.email, password: "Password123!" }));
    assert.equal(response.status, 200);
    const cookies = response.headers.getSetCookie();
    assert.equal(cookies.length, 2);
    assert.ok(cookies.every(cookie => cookie.includes("HttpOnly") && cookie.includes("Secure") && cookie.includes("SameSite=None")));
    const body = await response.json();
    assert.deepEqual(body.data.user, { id: 1, name: user.name, email: user.email });
    assert.equal(typeof body.data.accessToken, "string");
});

test("refresh rejects missing and unknown tokens", async () => {
    assert.equal((await request("/api/v1/auth/refresh-token", jsonBody({}))).status, 401);
    assert.equal((await request("/api/v1/auth/refresh-token", jsonBody({ refreshToken: "unknown" }))).status, 401);
});

test("QR multipart forms accept an empty optional custom code", async () => {
    const form = new FormData();
    form.set("form", JSON.stringify({ longUrl: "https://qr.example", customCode: "", title: "QR" }));
    form.set("image", new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), "test.png");
    const response = await request("/api/v1/qr/qr-generate", { method: "POST", body: form }, true);
    assert.equal(response.status, 201);
    assert.equal(links.at(-1)?.qrUrl, "https://images.example/qr.png");
});
