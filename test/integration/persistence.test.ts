import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { after, before, mock, test } from "node:test";
import bcrypt from "bcrypt";
import type { User } from "../../generated/prisma/client.js";

// Fail closed: these tests write data and must target explicit local test services.
for (const name of ["DATABASE_URL", "REDIS_URL"] as const) {
    assert.ok(process.env[name], `${name} must point to a local test service`);
    const url = new URL(process.env[name]!);
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), `${name} must be local`);
    if (name === "DATABASE_URL") assert.match(url.pathname, /test/i, "use a dedicated test database");
    else assert.equal(url.pathname, "/15", "use Redis test database 15");
}
Object.assign(process.env, {
    NODE_ENV: "test",
    BACK_END_URL: "https://short.example/",
    ACCESS_TOKEN_SECRET: "integration-access-secret",
    REFRESH_TOKEN_SECRET: "integration-refresh-secret",
    ACCESS_TOKEN_EXPIRES_IN: "15m",
    REFRESH_TOKEN_EXPIRES_IN: "30d",
});
const compiled = (path: string) => new URL(`../../dist/src/${path}`, import.meta.url);
// Real persistence; no external email or geolocation requests.
mock.module(compiled("lib/queqe.js"), { namedExports: { emailQueue: { add: async () => ({ id: "test" }) } } });
mock.module(compiled("services/geo.service.js"), { namedExports: { getClientGeoInfo: async () => ({ country: "India" }) } });
const { prisma }: typeof import("../../src/lib/db.js") = await import(compiled("lib/db.js").href);
const { client }: typeof import("../../src/lib/redis.js") = await import(compiled("lib/redis.js").href);
const { default: links }: typeof import("../../src/services/link/index.js") = await import(compiled("services/link/index.js").href);
const { default: auth }: typeof import("../../src/services/auth/index.js") = await import(compiled("services/auth/index.js").href);
const { default: temp }: typeof import("../../src/services/temp/index.js") = await import(compiled("services/temp/index.js").href);
const { otpKey }: typeof import("../../src/utils/otpKey.js") = await import(compiled("utils/otpKey.js").href);
const { hashToken }: typeof import("../../src/utils/hashToken.js") = await import(compiled("utils/hashToken.js").href);
const prefix = `ci-${randomUUID()}`;
const userIds: number[] = [];
const redisKeys: string[] = [];
let owner: User;
let other: User;
const clientInfo = { device: "test", browser: null, os: null, agent: "test" };

before(async () => {
    await prisma.$connect();
    assert.equal(await client.ping(), "PONG");
    const password = await bcrypt.hash("Password123!", 4);
    owner = await prisma.user.create({ data: { email: `${prefix}@example.test`, password, isEmailVerified: true } });
    userIds.push(owner.id);
    other = await prisma.user.create({ data: { email: `${prefix}-other@example.test` } });
    userIds.push(other.id);
});
after(async () => {
    try {
        // Delete only this run's records; user cascades remove links and sessions.
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        if (redisKeys.length) await client.del(...redisKeys);
    } finally {
        client.disconnect();
        await prisma.$disconnect();
        mock.restoreAll();
    }
});

test("links persist hashes and PostgreSQL enforces unique short codes", async () => {
    const input = { longUrl: "https://example.test", customCode: `${prefix}-unique`, password: "secret123" };
    await links.CreateLinkService(input, owner.id);
    const saved = await prisma.link.findUniqueOrThrow({ where: { shortCode: input.customCode } });
    assert.equal(saved.userId, owner.id);
    assert.equal(saved.is_password_protected, true);
    assert.equal(await bcrypt.compare(input.password, saved.password!), true);
    await assert.rejects(links.CreateLinkService(input, other.id), { code: "P2002" });
});

test("pagination and case-insensitive search isolate owners and omit password hashes", async () => {
    await prisma.link.createMany({ data: [0, 1, 2].map(i => ({
        userId: owner.id, shortCode: `${prefix}-page-${i}`, longUrl: "https://example.test",
        title: `${prefix}-Needle`, createdAt: new Date(Date.UTC(2026, 0, i + 1)),
    })) });
    await prisma.link.create({ data: { userId: other.id, shortCode: `${prefix}-foreign`, longUrl: "https://example.test", title: `${prefix}-Needle` } });
    const page = await links.GetUserLinksService(owner.id, { page: 2, limit: 2, search: `${prefix}-NEEDLE` });
    assert.deepEqual(page.pagination, { page: 2, limit: 2, total: 3, totalPages: 2 });
    assert.equal(page.links.length, 1);
    assert.equal(page.links[0].shortCode, `${prefix}-page-0`);
    assert.equal(page.links[0].userId, owner.id);
    assert.equal("password" in page.links[0], false);
});

test("another user cannot edit or delete a persisted link", async () => {
    const saved = await prisma.link.create({ data: { userId: owner.id, shortCode: `${prefix}-owned`, longUrl: "https://example.test" } });
    await assert.rejects(links.EditLinkService("changed", saved.id, other.id), { code: "P2025" });
    await assert.rejects(links.DeleteLinkService(saved.id, other.id), { code: "P2025" });
    assert.equal((await prisma.link.findUniqueOrThrow({ where: { id: saved.id } })).password, null);
    await links.EditLinkService("changed", saved.id, owner.id);
    assert.equal(await bcrypt.compare("changed", (await prisma.link.findUniqueOrThrow({ where: { id: saved.id } })).password!), true);
    await links.DeleteLinkService(saved.id, owner.id);
    assert.equal(await prisma.link.findUnique({ where: { id: saved.id } }), null);
});

test("login stores a hash, refresh rotates the session, and logout revokes it", async () => {
    const login = await auth.LoginService({ email: owner.email, password: "Password123!" }, clientInfo);
    const saved = await prisma.session.findUniqueOrThrow({ where: { refreshToken: hashToken(login.refreshToken) } });
    assert.notEqual(saved.refreshToken, login.refreshToken);
    const refreshed = await auth.RefreshAccessTokenService(login.refreshToken);
    assert.notEqual(refreshed.refreshToken, login.refreshToken);
    await assert.rejects(auth.RefreshAccessTokenService(login.refreshToken), { statusCode: 401 });
    assert.equal((await prisma.session.findUniqueOrThrow({ where: { id: saved.id } })).refreshToken, hashToken(refreshed.refreshToken));
    await auth.LogOutService(owner.id);
    await assert.rejects(auth.RefreshAccessTokenService(refreshed.refreshToken), { statusCode: 401 });
});

test("expired sessions are rejected and removed", async () => {
    const token = `${prefix}-expired`;
    const saved = await prisma.session.create({ data: { userId: owner.id, refreshToken: hashToken(token), expiresAt: new Date(0) } });
    await assert.rejects(auth.RefreshAccessTokenService(token), { statusCode: 401 });
    assert.equal(await prisma.session.findUnique({ where: { id: saved.id } }), null);
});

test("OTP verification updates PostgreSQL and consumes the Redis challenge", async () => {
    const key = otpKey(other.email);
    redisKeys.push(key);
    await client.setex(key, 300, createHash("sha256").update("1234").digest("hex"));
    await assert.rejects(auth.VerifyOtpService({ email: other.email, otp: 9999 }), { statusCode: 400 });
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).isEmailVerified, false);
    assert.ok(await client.get(key));
    await auth.VerifyOtpService({ email: other.email, otp: 1234 });
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).isEmailVerified, true);
    assert.equal(await client.get(key), null);
    await assert.rejects(auth.VerifyOtpService({ email: other.email, otp: 1234 }), { statusCode: 400 });
});

test("temporary links round-trip through Redis with a five-minute TTL", async () => {
    const key = `${prefix}-temp`;
    redisKeys.push(key);
    assert.equal(await temp.TempUrlService("https://example.test/temp", key), `https://short.example/temp/${key}`);
    assert.equal(await temp.TempredirectService(key), "https://example.test/temp");
    const ttl = await client.ttl(key);
    assert.ok(ttl > 0 && ttl <= 300);
    // Expire deterministically without a wall-clock sleep.
    await client.expire(key, 0);
    assert.equal(await temp.TempredirectService(key), null);
});
