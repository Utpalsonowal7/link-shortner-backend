import { z } from "zod";

const createLinkSchema = z.object({
     longUrl: z
          .string()
          .trim()
          .min(1, "URL is required")
          .max(2048, "URL is too long")
          .url("Must be a valid URL")
          .refine(
               (value) => {
                    const url = new URL(value);

                    return ["http:", "https:"].includes(url.protocol);
               },
               {
                    message: "Only HTTP and HTTPS URLs are allowed",
               },
          ),

     title: z
          .string()
          .trim()
          .max(120, "Title must be under 120 characters")
          .optional(),

     customCode: z
          .string()
          .trim()
          .min(3, "Custom code must be at least 3 characters")
          .max(7, "Custom code must be under 7 characters")
          .regex(
               /^[a-zA-Z0-9-_]+$/,
               "Only letters, numbers, hyphens and underscores allowed",
          )
          .optional(),

     tags: z
          .array(z.string().trim().max(30))
          .max(10, "Maximum 10 tags allowed")
          .optional(),

     password: z
          .string()
          .min(5, "Password must be at least 5 characters long")
          .max(100)
          .optional(),

     expiresAt: z.string().optional(),

     utmSource: z.string().trim().max(100).optional(),
     utmMedium: z.string().trim().max(100).optional(),
     utmCampaign: z.string().trim().max(150).optional(),
     utmTerm: z.string().trim().max(150).optional(),
     utmContent: z.string().trim().max(150).optional(),
});

const linkQuerySchema = z.object({
     page: z.coerce.number().int().positive().default(1),
     limit: z.coerce.number().int().positive().max(100).default(20),
     search: z.string().trim().optional(),
});

export { createLinkSchema, linkQuerySchema };
