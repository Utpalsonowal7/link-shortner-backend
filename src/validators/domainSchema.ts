import { z } from "zod";
export const domainSchema = z.object({ domain: z.string().trim().min(1).max(253) }).strict();
export const idParams = z.object({ id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER) });
