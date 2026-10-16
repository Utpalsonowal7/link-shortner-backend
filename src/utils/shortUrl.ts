import { requiredEnv } from "./env.js";

// A link's assigned hostname is canonical even if DNS is temporarily unverified.
// Never silently rewrite an existing branded link to the service hostname.
export function shortUrl(link: { shortCode: string; domain?: { domain: string } | null; domainName?: string | null }) {
    const base = link.domain?.domain || link.domainName;
    return `${base ? `https://${base}` : requiredEnv("BACK_END_URL").replace(/\/+$/, "")}/${link.shortCode}`;
}
export const domainSelect = { select: { domain: true } } as const;
