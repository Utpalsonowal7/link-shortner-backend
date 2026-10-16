import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import ipaddr from "ipaddr.js";
import { requiredEnv } from "../../utils/env.js";
import { normalizeDomain } from "../../utils/domain.js";

export const routingProofPath = "/.well-known/lnkshrt-domain-verification";
type Address = { address: string; family: number };
export function routingProof(hostname: string, nonce: string, secret = requiredEnv("ACCESS_TOKEN_SECRET")) {
    return createHmac("sha256", secret).update(`lnkshrt-routing-v1\n${hostname}\n${nonce}`).digest("hex");
}
export function isPublicAddress(address: string) {
    try {
        const parsed = ipaddr.parse(address);
        // Reject IPv4-mapped IPv6, transition mechanisms, private/reserved/metadata ranges.
        return parsed.range() === "unicast";
    } catch { return false; }
}

async function probe(hostname: string, nonce: string, addresses: Address[]): Promise<string> {
    const address = addresses.find(a => a.family === 4) ?? addresses[0];
    return new Promise((resolve, reject) => {
        // Pin the prevalidated DNS address; preserve hostname for Host, SNI and TLS validation.
        // No proxy environment, redirects, cookies, or credentials are used.
        const req = request({
            hostname, servername: hostname, port: 443,
            path: `${routingProofPath}?nonce=${nonce}`,
            method: "GET", agent: false, family: address.family,
            lookup: (_host, _options, callback) => callback(null, address.address, address.family),
            headers: { Accept: "text/plain", "Cache-Control": "no-cache" },
        }, response => {
            if (response.statusCode !== 200) {
                response.destroy();
                reject(new Error("Routing proof did not return 200"));
                return;
            }
            let body = "";
            response.setEncoding("utf8");
            response.on("data", (chunk: string) => {
                body += chunk;
                if (Buffer.byteLength(body) > 1024) response.destroy(new Error("Routing proof too large"));
            });
            response.on("end", () => resolve(body.trim()));
            response.on("error", reject);
        });
        const timer = setTimeout(() => req.destroy(new Error("Routing proof timeout")), 5000);
        req.on("close", () => clearTimeout(timer));
        req.on("error", reject);
        req.end();
    });
}
const resolve = (hostname: string): Promise<Address[]> => lookup(hostname, { all: true, verbatim: true });
export async function checkProxyRouting(
    value: string,
    dependencies: { resolve?: typeof resolve; probe?: typeof probe } = {},
) {
    const hostname = normalizeDomain(value);
    let timer: NodeJS.Timeout | undefined;
    try {
        const addresses = await Promise.race([
            (dependencies.resolve ?? resolve)(hostname),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("DNS timeout")), 2000); }),
        ]);
        if (!addresses.length || addresses.some(address => !isPublicAddress(address.address))) return false;
        const nonce = randomBytes(24).toString("hex");
        const expected = routingProof(hostname, nonce);
        const body = await (dependencies.probe ?? probe)(hostname, nonce, addresses);
        return /^[a-f0-9]{64}$/.test(body) && timingSafeEqual(Buffer.from(body, "hex"), Buffer.from(expected, "hex"));
    } catch { return false; }
    finally { if (timer) clearTimeout(timer); }
}
