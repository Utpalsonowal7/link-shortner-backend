import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDomain } from "../src/utils/domain.js";
import { checkDomainDns } from "../src/services/domain/dns.js";
import { createBioSchema, updateBioSchema } from "../src/validators/bioSchema.js";

test("domain normalization accepts hostnames and rejects URLs, IPs and malformed labels", () => {
    assert.equal(normalizeDomain("  Links.Example.COM. "), "links.example.com");
    assert.equal(normalizeDomain("bücher.example"), "xn--bcher-kva.example");
    for (const value of [null, "", "https://example.com", "example.com/path", "user@example.com", "example.com:443", "*.example.com", "127.0.0.1", "localhost", "-bad.example", "bad..example", "bad_example.com", "example.123"]) {
        assert.throws(() => normalizeDomain(value), { statusCode: 422 });
    }
});

test("verification requires an exact TXT token and exact CNAME target", async () => {
    const dns = { resolveTxt: async (name: string) => { assert.equal(name, "_utpx-verification.links.example.com"); return [["token-", "123"]]; }, resolveCname: async () => ["SHORT.EXAMPLE.COM."] };
    assert.deepEqual(await checkDomainDns("links.example.com", "token-123", "short.example.com", dns), { ownership: true, routing: true });
    assert.deepEqual(await checkDomainDns("links.example.com", "wrong", "short.example.com", { ...dns, resolveCname: async () => ["short.example.com.attacker.test"] }), { ownership: false, routing: false });
});

test("missing DNS records fail verification; resolver outages are retryable errors", async () => {
    const missing = async (): Promise<never> => { throw Object.assign(new Error("missing"), { code: "ENODATA" }); };
    assert.deepEqual(await checkDomainDns("a.example", "token", "b.example", { resolveTxt: missing, resolveCname: missing }), { ownership: false, routing: false });
    const timeout = async (): Promise<never> => { throw Object.assign(new Error("timeout"), { code: "ETIMEOUT" }); };
    await assert.rejects(checkDomainDns("a.example", "token", "b.example", { resolveTxt: timeout, resolveCname: missing }), { statusCode: 503 });
});

test("bio validation normalizes slugs, defaults to draft, and rejects executable URLs", () => {
    const input = { slug: "Utpal", displayName: "Utpal", links: [{ title: "Portfolio", url: "https://utpx.in" }] };
    const parsed = createBioSchema.parse(input);
    assert.equal(parsed.slug, "utpal");
    assert.equal(parsed.isPublished, false);
    assert.equal(parsed.links[0].isActive, true);
    for (const url of ["javascript:alert(1)", "data:text/html,hello", "ftp://example.com", "https://user:password@example.com"]) {
        assert.equal(createBioSchema.safeParse({ ...input, links: [{ title: "bad", url }] }).success, false);
    }
    assert.equal(createBioSchema.safeParse({ ...input, slug: "admin" }).success, false);
    assert.equal(createBioSchema.safeParse({ ...input, userId: 999 }).success, false);
    assert.equal(createBioSchema.safeParse({ ...input, links: Array(51).fill(input.links[0]) }).success, false);
});

test("bio patches do not reset absent fields, and allow clearing links/domain", () => {
    assert.deepEqual(updateBioSchema.parse({ displayName: "New" }), { displayName: "New" });
    assert.deepEqual(updateBioSchema.parse({ domainId: null, links: [] }), { domainId: null, links: [] });
    assert.equal(updateBioSchema.safeParse({}).success, false);
});

test("bio design defaults preserve old clients and patches preserve omitted design", () => {
    const page = createBioSchema.parse({ slug: "older-page", displayName: "Older" });
    assert.deepEqual(page.design, { preset: "minimal", buttonStyle: "rounded", socials: [] });
    assert.equal("design" in updateBioSchema.parse({ displayName: "New" }), false);
    assert.equal(createBioSchema.parse({ slug: "icons", displayName: "Icons", links: [{ title: "Site", url: "https://example.com" }] }).links[0].icon, "link");
});

test("bio design accepts supported palettes, buttons, social/email and link icons", () => {
    const design = { preset: "ocean", buttonStyle: "pill", socials: [
        { platform: "github", url: "https://github.com/utpal" },
        { platform: "email", url: "hello@example.com" },
    ] };
    assert.deepEqual(updateBioSchema.parse({ design }).design, design);
    assert.equal(createBioSchema.parse({ slug: "icons", displayName: "Icons", links: [{ title: "Code", url: "https://github.com", icon: "code" }] }).links[0].icon, "code");
    assert.equal(updateBioSchema.safeParse({ design: { ...design, socials: [] } }).success, true);
});

test("bio design rejects CSS injection, unsupported icons and unsafe social destinations", () => {
    const base = { preset: "rose", buttonStyle: "outline", socials: [] };
    for (const design of [
        { ...base, preset: "url(javascript:alert(1))" },
        { ...base, css: "body{display:none}" },
        { ...base, socials: [{ platform: "github", url: "javascript:alert(1)" }] },
        { ...base, socials: [{ platform: "github", url: "https://u:p@example.com" }] },
        { ...base, socials: [{ platform: "email", url: "mailto:hi@example.com" }] },
        { ...base, socials: [{ platform: "email", url: "hi@example.com?body=spam" }] },
        { ...base, socials: Array(9).fill({ platform: "website", url: "https://example.com" }) },
    ]) assert.equal(updateBioSchema.safeParse({ design }).success, false);
    assert.equal(updateBioSchema.safeParse({ links: [{ title: "Bad", url: "https://example.com", icon: "<svg>" }] }).success, false);
});
