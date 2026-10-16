import { httpRequest } from "../helpers/http.js";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { after, before, mock, test } from "node:test";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "node:net";
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
    CORS_ORIGIN: "https://frontend.example",
    FRONTEND_URL: "https://frontend.example",
    CUSTOM_DOMAIN_TARGET: "short.example",
    RAZORPAY_KEY_ID: "test",
    RAZORPAY_KEY_SECRET: "test",
    BACK_END_URL: "https://short.example/",
    ACCESS_TOKEN_SECRET: "integration-access-secret",
    REFRESH_TOKEN_SECRET: "integration-refresh-secret",
    ACCESS_TOKEN_EXPIRES_IN: "15m",
    REFRESH_TOKEN_EXPIRES_IN: "30d",
});
const compiled = (path: string) => new URL(`../../dist/src/${path}`, import.meta.url);
let dnsChecks = { ownership: true, routing: true };
mock.module(compiled("services/domain/dns.js"), { namedExports: { checkDomainDns: async () => dnsChecks } });
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
const { default: domains }: typeof import("../../src/services/domain/index.js") = await import(compiled("services/domain/index.js").href);
const bio: typeof import("../../src/services/bio/index.js") = await import(compiled("services/bio/index.js").href);
const { createBioSchema }: typeof import("../../src/validators/bioSchema.js") = await import(compiled("validators/bioSchema.js").href);
const { default: app }: typeof import("../../src/app.js") = await import(compiled("app.js").href);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
function request(path: string, method = "GET", body?: unknown, authenticated = true, host = "short.example", forwardedHost?: string) {
    const headers: Record<string, string> = { host, "content-type": "application/json" };
    if (authenticated) headers.authorization = `Bearer ${jwt.sign({ email: owner.email }, process.env.ACCESS_TOKEN_SECRET!)}`;
    if (forwardedHost) headers["x-forwarded-host"] = forwardedHost;
    return httpRequest(baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual", signal: AbortSignal.timeout(5000) });
}
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
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        await prisma.bioPage.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.link.deleteMany({ where: { userId: { in: userIds } } });
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


test("domain HTTP API validates input and verifies both records before allowing assignment", async () => {
    assert.equal((await request("/api/v1/domain", "POST", { domain: "https://bad.example" })).status, 422);
    assert.equal((await request("/api/v1/domain", "POST", {}, false)).status, 401);
    const response = await request("/api/v1/domain", "POST", { domain: `${prefix}.example.com` });
    assert.equal(response.status, 201);
    const domain = (await response.json()).data;
    assert.equal(domain.isVerified, false);
    assert.equal(domain.dns.ownership.type, "TXT");
    assert.equal(domain.dns.routing.name, `${prefix}.example.com`);
    await assert.rejects(links.CreateLinkService({ longUrl: "https://example.test", domainId: domain.id }, owner.id), { statusCode: 422 });
    dnsChecks = { ownership: true, routing: false };
    assert.equal((await domains.VerifyDomain(owner.id, domain.id)).isVerified, false);
    dnsChecks = { ownership: false, routing: true };
    assert.equal((await domains.VerifyDomain(owner.id, domain.id)).isVerified, false);
    dnsChecks = { ownership: true, routing: true };
    assert.equal((await request(`/api/v1/domain/${domain.id}/verify`, "POST")).status, 200);
    assert.equal((await prisma.domain.findUniqueOrThrow({ where: { id: domain.id } })).isVerified, true);
    await assert.rejects(domains.VerifyDomain(other.id, domain.id), { statusCode: 404 });
    await assert.rejects(links.CreateLinkService({ longUrl: "https://example.test", domainId: domain.id }, other.id), { statusCode: 422 });
    assert.equal((await request("/api/v1/domain/invalid")).status, 422);
});

test("custom-domain redirects are isolated, ignore forwarded-host spoofing and stop after failed re-verification", async () => {
    const domain = await domains.CreateDomainService(owner.id, `${prefix}-redirect.example.com`);
    await domains.VerifyDomain(owner.id, domain.id);
    const response = await request("/api/v1/links", "POST", { longUrl: "https://example.test/landing", domainId: domain.id });
    assert.equal(response.status, 201);
    const shortLink: string = (await response.json()).data.shortLink;
    assert.equal(new URL(shortLink).host, domain.domain);
    const path = new URL(shortLink).pathname;
    // Protected links avoid asynchronous analytics writes during cleanup.
    await prisma.link.update({ where: { shortCode: path.slice(1) }, data: { is_password_protected: true, password: "test" } });
    assert.equal((await request(path, "GET", undefined, false, domain.domain)).status, 302);
    const second = await domains.CreateDomainService(owner.id, `${prefix}-second.example.com`);
    await domains.VerifyDomain(owner.id, second.id);
    assert.equal((await request(path, "GET", undefined, false, second.domain)).status, 404);
    assert.equal((await request(path, "GET", undefined, false, "unknown.example.com", domain.domain)).status, 404);
    await assert.rejects(domains.DeleteDomain(owner.id, domain.id), { statusCode: 409 });
    assert.ok(await prisma.link.findUnique({ where: { shortCode: path.slice(1) } }));
    dnsChecks = { ownership: false, routing: true };
    await domains.VerifyDomain(owner.id, domain.id);
    assert.equal((await request(path, "GET", undefined, false, domain.domain)).status, 404);
    dnsChecks = { ownership: true, routing: true };
});

test("bio HTTP CRUD keeps drafts private and publishes only safe public fields and active links", async () => {
    assert.equal((await request("/api/v1/bio-pages", "POST", {}, false)).status, 401);
    assert.equal((await request("/api/v1/bio-pages", "POST", { slug: "bad", displayName: "Bad", links: [{ title: "Bad", url: "javascript:alert(1)" }] })).status, 422);
    const input = { slug: `${prefix}-bio`, displayName: "Utpal", links: [{ title: "Portfolio", url: "https://utpx.in" }, { title: "Hidden", url: "https://example.com", isActive: false }] };
    const created = await request("/api/v1/bio-pages", "POST", input);
    assert.equal(created.status, 201);
    const page = (await created.json()).data;
    assert.equal((await request(`/api/v1/public/bio-pages/${input.slug}`, "GET", undefined, false)).status, 404);
    assert.equal((await request(`/api/v1/bio-pages/${page.id}`, "PATCH", { isPublished: true })).status, 200);
    const published = await request(`/api/v1/public/bio-pages/${input.slug}`, "GET", undefined, false);
    assert.equal(published.status, 200);
    const publicPage = (await published.json()).data;
    assert.equal(publicPage.links.length, 1);
    assert.equal(publicPage.links[0].title, "Portfolio");
    assert.deepEqual(publicPage.design, { preset: "minimal", buttonStyle: "rounded", socials: [] });
    const design = { preset: "forest", buttonStyle: "shadow", socials: [{ platform: "github", url: "https://github.com/utpal" }] };
    const styled = await request(`/api/v1/bio-pages/${page.id}`, "PATCH", { design, links: [{ title: "Code", url: "https://github.com/utpal", icon: "code" }] });
    assert.equal(styled.status, 200);
    assert.deepEqual((await bio.getBio(owner.id, page.id)).design, design);
    const styledPublic = (await (await request(`/api/v1/public/bio-pages/${input.slug}`, "GET", undefined, false)).json()).data;
    assert.deepEqual(styledPublic.design, design);
    assert.equal(styledPublic.links[0].icon, "code");
    for (const privateField of ["userId", "domainId", "isPublished", "verificationToken"]) assert.equal(privateField in publicPage, false);
    assert.equal((await request("/api/v1/bio-pages", "POST", input)).status, 409);
    await assert.rejects(bio.getBio(other.id, page.id), { statusCode: 404 });
    await assert.rejects(bio.updateBio(other.id, page.id, { displayName: "Hijacked" }), { statusCode: 404 });
    await assert.rejects(bio.deleteBio(other.id, page.id), { statusCode: 404 });
    await request(`/api/v1/bio-pages/${page.id}`, "PATCH", { links: [{ title: "Second", url: "https://two.example" }, { title: "First", url: "https://one.example" }] });
    assert.deepEqual((await bio.getBio(owner.id, page.id)).links.map(l => [l.title, l.position]), [["Second", 0], ["First", 1]]);
    await request(`/api/v1/bio-pages/${page.id}`, "PATCH", { isPublished: false });
    assert.equal((await request(`/api/v1/public/bio-pages/${input.slug}`, "GET", undefined, false)).status, 404);
    assert.equal((await request(`/api/v1/bio-pages/${page.id}`, "DELETE")).status, 200);
    assert.equal(await prisma.bioLink.count({ where: { pageId: page.id } }), 0);
});

test("bio domains require verification and ownership, are exclusive, and can be detached safely", async () => {
    const domain = await domains.CreateDomainService(owner.id, `${prefix}-bio.example.com`);
    const input = createBioSchema.parse({ slug: `${prefix}-domain`, displayName: "Bio", domainId: domain.id, isPublished: true });
    await assert.rejects(bio.createBio(owner.id, input), { statusCode: 422 });
    await domains.VerifyDomain(owner.id, domain.id);
    await assert.rejects(bio.createBio(other.id, input), { statusCode: 422 });
    const page = await bio.createBio(owner.id, input);
    await assert.rejects(bio.createBio(owner.id, { ...input, slug: `${prefix}-another` }), { statusCode: 409 });
    assert.equal((await request("/", "GET", undefined, false, domain.domain)).status, 200);
    assert.equal((await request(`/api/v1/public/bio-pages/domain/${domain.domain}`, "GET", undefined, false)).status, 200);
    await assert.rejects(domains.DeleteDomain(owner.id, domain.id), { statusCode: 409 });
    dnsChecks = { ownership: false, routing: false };
    await domains.VerifyDomain(owner.id, domain.id);
    assert.equal((await request(`/api/v1/public/bio-pages/domain/${domain.domain}`, "GET", undefined, false)).status, 404);
    dnsChecks = { ownership: true, routing: true };
    await bio.updateBio(owner.id, page.id, { domainId: null });
    await domains.DeleteDomain(owner.id, domain.id);
    assert.ok(await bio.getBio(owner.id, page.id));
});
