import { z } from "zod";
export const webUrl = z.string().trim().max(2048).url().refine(value => {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
}, "Only HTTP(S) URLs without credentials are allowed");
export const bioSlug = z.string().trim().toLowerCase().min(3).max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .refine(value => !["admin", "api", "auth", "login", "register", "settings", "dashboard", "public"].includes(value), "This slug is reserved");
export const bioIcon = z.enum(["link", "globe", "code", "video", "music", "mail", "shop", "book", "heart", "download"]);
const social = z.discriminatedUnion("platform", [
    z.object({ platform: z.literal("email"), url: z.string().trim().email().max(254) }).strict(),
    z.object({ platform: z.enum(["github", "linkedin", "instagram", "youtube", "x", "website"]), url: webUrl }).strict(),
]);
export const bioDesign = z.object({
    preset: z.enum(["minimal", "midnight", "ocean", "rose", "forest", "sunset"]),
    buttonStyle: z.enum(["rounded", "pill", "outline", "shadow"]),
    socials: z.array(social).max(8),
}).strict();
const defaultDesign = { preset: "minimal" as const, buttonStyle: "rounded" as const, socials: [] };
const fields = {
    slug: bioSlug,
    displayName: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500),
    avatarUrl: webUrl.nullable(),
    theme: z.enum(["light", "dark", "system"]),
    design: bioDesign,
    isPublished: z.boolean(),
    domainId: z.number().int().positive().nullable(),
    links: z.array(z.object({ title: z.string().trim().min(1).max(100), url: webUrl, icon: bioIcon.default("link"), isActive: z.boolean().default(true) }).strict()).max(50),
};
export const createBioSchema = z.object({ ...fields,
    description: fields.description.default(""), avatarUrl: fields.avatarUrl.default(null),
    design: fields.design.default(defaultDesign), theme: fields.theme.default("light"), isPublished: fields.isPublished.default(false),
    domainId: fields.domainId.default(null), links: fields.links.default([]),
}).strict();
export const updateBioSchema = z.object(fields).partial().strict().refine(value => Object.keys(value).length > 0, "Provide at least one field");
export type CreateBioInput = z.infer<typeof createBioSchema>;
export type UpdateBioInput = z.infer<typeof updateBioSchema>;
