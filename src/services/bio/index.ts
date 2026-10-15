import { prisma } from "../../lib/db.js";
import { ApiError } from "../../utils/api_error.js";
import { requireVerifiedDomain } from "../domain/index.js";
import type { CreateBioInput, UpdateBioInput } from "../../validators/bioSchema.js";
import type { Prisma } from "../../../generated/prisma/client.js";

const include = { links: { orderBy: { position: "asc" as const } } };
const publicSelect = {
    slug: true, displayName: true, description: true, avatarUrl: true, theme: true,
    links: { where: { isActive: true }, orderBy: { position: "asc" as const }, select: { id: true, title: true, url: true, position: true } },
} satisfies Prisma.BioPageSelect;
function translate(error: unknown): never {
    const code = (error as { code?: string }).code;
    if (code === "P2002") throw new ApiError(409, "This slug or domain is already assigned to a bio page");
    if (code === "P2025") throw new ApiError(404, "Bio page not found");
    throw error;
}
export async function createBio(userId: number, input: CreateBioInput) {
    try {
        return await prisma.$transaction(async tx => {
            if (input.domainId) await requireVerifiedDomain(userId, input.domainId, tx);
            const { links, ...data } = input;
            return tx.bioPage.create({ data: { ...data, userId, links: { create: links.map((link, position) => ({ ...link, position })) } }, include });
        });
    } catch (error) { return translate(error); }
}
export const listBios = (userId: number) => prisma.bioPage.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include });
export async function getBio(userId: number, id: number) {
    const page = await prisma.bioPage.findFirst({ where: { id, userId }, include });
    if (!page) throw new ApiError(404, "Bio page not found");
    return page;
}
export async function updateBio(userId: number, id: number, input: UpdateBioInput) {
    try {
        return await prisma.$transaction(async tx => {
            if (!await tx.bioPage.findFirst({ where: { id, userId } })) throw new ApiError(404, "Bio page not found");
            if (input.domainId) await requireVerifiedDomain(userId, input.domainId, tx);
            const { links, ...data } = input;
            return tx.bioPage.update({ where: { id, userId }, data: { ...data,
                ...(links !== undefined ? { links: { deleteMany: {}, create: links.map((link, position) => ({ ...link, position })) } } : {}),
            }, include });
        });
    } catch (error) { return translate(error); }
}
export async function deleteBio(userId: number, id: number) {
    try { await prisma.bioPage.delete({ where: { id, userId } }); }
    catch (error) { translate(error); }
}
export async function publicBio(where: Prisma.BioPageWhereInput) {
    const page = await prisma.bioPage.findFirst({ where: { AND: [where, { isPublished: true }] }, select: publicSelect });
    if (!page) throw new ApiError(404, "Bio page not found");
    return page;
}
