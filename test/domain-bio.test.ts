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
