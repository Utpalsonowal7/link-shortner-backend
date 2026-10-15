import { Resolver } from "node:dns/promises";
import { ApiError } from "../../utils/api_error.js";

interface DnsResolver {
    resolveTxt(host: string): Promise<string[][]>;
    resolveCname(host: string): Promise<string[]>;
}
const resolver = new Resolver({ timeout: 2000, tries: 2 });
async function lookup<T>(operation: () => Promise<T>, empty: T): Promise<T> {
    try { return await operation(); }
    catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENODATA" || code === "ENOTFOUND") return empty;
        throw new ApiError(503, "DNS lookup unavailable; retry verification shortly");
    }
}
export async function checkDomainDns(host: string, token: string, target: string, dns: DnsResolver = resolver) {
    const [txt, cnames] = await Promise.all([
        lookup(() => dns.resolveTxt(`_utpx-verification.${host}`), []),
        lookup(() => dns.resolveCname(host), []),
    ]);
    return {
        ownership: txt.some(parts => parts.join("") === token),
        routing: cnames.some(name => name.toLowerCase().replace(/\.$/, "") === target),
    };
}
