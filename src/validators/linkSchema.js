import { z } from "zod";

const createLinkSchema = z.object({
     longUrl: z.string().url("Must be a valid URL").trim(),
     title: z
          .string()
          .trim()
          .max(120, "Title must be under 120 characters")
          .optional(),
     customCode: z
          .string()
          .trim()
          .min(3, "Custom code must be at least 3 characters")
          .max(30, "Custom code must be under 30 characters")
          .regex(
               /^[a-zA-Z0-9-_]+$/,
               "Only letters, numbers, hyphens and underscores allowed",
          )
          .optional(),
     tags: z
          .array(z.string().trim().max(30))
          .max(10, "Maximum 10 tags allowed")
          .optional(),
});

const linkQuerySchema = z.object({
     page: z.coerce.number().int().positive().default(1),
     limit: z.coerce.number().int().positive().max(100).default(20),
     search: z.string().trim().optional(),
});

export { createLinkSchema,linkQuerySchema };
