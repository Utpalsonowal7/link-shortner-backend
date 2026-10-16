import assert from "node:assert/strict";
import { test } from "node:test";
import { checkProxyRouting, isPublicAddress, routingProof } from "../src/services/domain/proxy.js";
import { shortUrl } from "../src/utils/shortUrl.js";

process.env.ACCESS_TOKEN_SECRET = "test-domain-proof-key";
process.env.BACK_END_URL = "https://short.example/";
const publicDns = async () => [{ address: "1.1.1.1", family: 4 }];

test("custom-domain URLs stay canonical and primary URLs have one separator", () => {
    assert.equal(shortUrl({ shortCode: "abc", domain: { domain: "links.brand.example" } }), "https://links.brand.example/abc");
    assert.equal(shortUrl({ shortCode: "abc", domainName: "links.brand.example" }), "https://links.brand.example/abc");
    assert.equal(shortUrl({ shortCode: "abc", domain: null }), "https://short.example/abc");
    process.env.BACK_END_URL = "https://short.example";
    assert.equal(shortUrl({ shortCode: "abc" }), "https://short.example/abc");
});

test("proxy proof must match hostname, nonce and secret", async () => {
    assert.notEqual(routingProof("one.example", "123"), routingProof("two.example", "123"));
    assert.notEqual(routingProof("one.example", "123"), routingProof("one.example", "456"));
    assert.notEqual(routingProof("one.example", "123", "one"), routingProof("one.example", "123", "two"));
    const probe = async (host: string, nonce: string) => routingProof(host, nonce);
    assert.equal(await checkProxyRouting("links.example.com", { resolve: publicDns, probe }), true);
    for (const value of ["OK", "a".repeat(64), routingProof("wrong.example", "fixed"), "<html>Welcome</html>"]) {
        assert.equal(await checkProxyRouting("links.example.com", { resolve: publicDns, probe: async () => value }), false);
    }
});

test("public address validation blocks private, metadata, mapped, transition and special ranges", () => {
    for (const ip of ["127.0.0.1", "10.0.0.1", "172.31.44.1", "192.168.1.1", "169.254.169.254", "100.100.100.200", "0.0.0.0", "224.0.0.1", "::1", "::", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "::ffff:8.8.8.8", "2002:7f00:1::", "not-an-ip"]) {
        assert.equal(isPublicAddress(ip), false, ip);
    }
    assert.equal(isPublicAddress("1.1.1.1"), true);
    assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("proxy verification never probes empty/mixed private DNS, and failures stay unverified", async () => {
    for (const addresses of [[], [{ address: "127.0.0.1", family: 4 }], [...await publicDns(), { address: "169.254.169.254", family: 4 }]]) {
        let called = false;
        assert.equal(await checkProxyRouting("links.example.com", { resolve: async () => addresses, probe: async () => { called = true; return ""; } }), false);
        assert.equal(called, false);
    }
    assert.equal(await checkProxyRouting("links.example.com", { resolve: async () => { throw new Error("DNS"); } }), false);
    assert.equal(await checkProxyRouting("links.example.com", { resolve: publicDns, probe: async () => { throw new Error("TLS/timeout"); } }), false);
});
