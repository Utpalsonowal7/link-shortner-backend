import { randomBytes } from "node:crypto";
import type { Domain, Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../lib/db.js";
import { ApiError } from "../../utils/api_error.js";
import { requiredEnv } from "../../utils/env.js";
import { normalizeDomain } from "../../utils/domain.js";
import { checkDomainDns } from "./dns.js";
import { checkProxyRouting } from "./proxy.js";

const target = () => normalizeDomain(requiredEnv("CUSTOM_DOMAIN_TARGET"));
function present(domain: Domain) {
    const { verificationToken, userId: _userId, ...data } = domain;
    return { ...data, dns: {
        ownership: { type: "TXT", name: `_utpx-verification.${domain.domain}`, value: verificationToken },
        routing: { type: "CNAME", name: domain.domain, value: target() },
    } };
}
async function owned(userId: number, id: number) {
    const domain = await prisma.domain.findFirst({ where: { id, userId } });
    if (!domain) throw new ApiError(404, "Domain not found");
    return domain;
}
export async function requireVerifiedDomain(userId: number, id: number, db: Prisma.TransactionClient = prisma) {
    const domain = await db.domain.findFirst({ where: { id, userId, isVerified: true } });
    if (!domain) throw new ApiError(422, "Choose a verified domain owned by your account");
    return domain;
}
const createDomain = async (userId: number, value: unknown) => {
    const domain = normalizeDomain(value);
    if (domain === target() || domain === new URL(requiredEnv("BACK_END_URL")).hostname) {
        throw new ApiError(422, "The service hostname cannot be registered as a custom domain");
    }
    try {
        return present(await prisma.domain.create({ data: {
            userId, domain, verificationToken: `utpx_verify_${randomBytes(24).toString("hex")}`,
        } }));
    } catch (error) {
        if ((error as { code?: string }).code === "P2002") throw new ApiError(409, "Domain already exists");
        throw error;
    }
};
const verifyDomain = async (userId: number, id: number) => {
    const domain = await owned(userId, id);
    const checks = { ...await checkDomainDns(domain.domain, domain.verificationToken, target()) };
    const cnameMatched = checks.routing;
    if (checks.ownership && !checks.routing) checks.routing = await checkProxyRouting(domain.domain);
    const routingMethod = checks.routing ? (cnameMatched ? "cname" : "https") : null;
    const isVerified = checks.ownership && checks.routing;
    const updated = await prisma.domain.update({ where: { id, userId }, data: {
        isVerified, verifiedAt: isVerified ? new Date() : null,
    } });
    return { ...present(updated), checks: { ...checks, routingMethod } };
};
const deleteDomain = async (userId: number, id: number) => {
    await owned(userId, id);
    try { await prisma.domain.delete({ where: { id, userId } }); }
    catch (error) {
        if ((error as { code?: string }).code === "P2003") throw new ApiError(409, "Remove this domain from its links and bio page before deleting it");
        throw error;
    }
    return { message: "Domain deleted successfully" };
};
export default {
    CreateDomainService: createDomain,
    GetDomainUser: async (userId: number) => ({ domainFormat: (await prisma.domain.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })).map(present) }),
    GetDomainByIf: async (userId: number, id: number) => present(await owned(userId, id)),
    VerifyDomain: verifyDomain,
    DeleteDomain: deleteDomain,
};
