import { prisma } from "../lib/db.js";
import { requiredEnv } from "./env.js";
import { ApiError } from "./api_error.js";

// Use Host, never an untrusted X-Forwarded-Host, to select a tenant.
export async function redirectDomain(hostHeader: string | undefined): Promise<number | null> {
    if (!hostHeader || /[\s/@?#\\]/.test(hostHeader)) throw new ApiError(400, "Invalid Host header");
    let host: string;
    try { host = new URL(`http://${hostHeader}`).hostname.toLowerCase().replace(/\.$/, ""); }
    catch { throw new ApiError(400, "Invalid Host header"); }
    if (host === new URL(requiredEnv("BACK_END_URL")).hostname.toLowerCase()) return null;
    const domain = await prisma.domain.findUnique({ where: { domain: host } });
    if (!domain?.isVerified) throw new ApiError(404, "Domain not found or not verified");
    return domain.id;
}
