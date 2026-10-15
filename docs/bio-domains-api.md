# Bio pages and custom domains: frontend API contract

Base: `/api/v1`. Responses use `{ statusCode, success, data, message }`. Private endpoints accept the existing access-token cookie or `Authorization: Bearer <token>`. Validation failures are 422, unauthenticated requests 401, inaccessible records 404, and uniqueness/in-use conflicts 409.

## Bio pages

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/bio-pages` | List the signed-in user's pages, including drafts and inactive links |
| POST | `/bio-pages` | Create a page (draft by default) |
| GET | `/bio-pages/:id` | Owner preview/edit data |
| PATCH | `/bio-pages/:id` | Update supplied fields only |
| DELETE | `/bio-pages/:id` | Delete the page and its link rows |
| GET | `/public/bio-pages/:slug` | Published public page |
| GET | `/public/bio-pages/domain/:hostname` | Published page on an exactly matched, verified domain |

Create example:

```json
{
  "slug": "utpal",
  "displayName": "Utpal Sonowal",
  "description": "Full-stack developer",
  "avatarUrl": "https://example.com/avatar.png",
  "theme": "light",
  "links": [
    { "title": "Portfolio", "url": "https://utpx.in", "isActive": true },
    { "title": "GitHub", "url": "https://github.com/Utpalsonowal7", "isActive": true }
  ]
}
```

- Slugs are globally unique, lowercase, 3–50 letters/digits/hyphens. Some application names are reserved.
- `theme`: `light`, `dark`, or `system`. Description maximum 500 characters, display name maximum 100.
- Maximum 50 links. HTTP(S) destinations only; credentials in URLs are rejected. The frontend must render text as text, never raw HTML.
- `PATCH { "links": [...] }` atomically replaces all links in array order, assigning positions starting at zero. Link IDs may change. Omit `links` to preserve them; `[]` clears them.
- `PATCH { "isPublished": true }` publishes; `false` makes public reads return 404 immediately (no-store responses).
- `domainId` attaches an owned, verified domain; `null` detaches it. One domain can belong to only one bio page.
- Public responses expose only slug, displayName, description, avatarUrl, theme and active links (`id`, `title`, `url`, `position`). Owner IDs, verification tokens, drafts and inactive links are excluded.
- The API root `/` on an attached verified custom Host returns the published bio-page JSON. HTML rendering is frontend work; it can use the public domain lookup endpoint. No frontend UI or automatic TLS provisioning is included in this backend change.

## Domains

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/domain` | Register `{ "domain": "links.example.com" }` |
| GET | `/domain` | Owner list (existing `data.domains.domainFormat` envelope retained) |
| GET | `/domain/:id` | Owner detail in `data.domain`, including DNS instructions |
| POST | `/domain/:id/verify` | Check DNS ownership and routing |
| DELETE | `/domain/:id` | Delete an unused domain |

Enter a hostname, not a URL, IP, wildcard, port, or path. Names are lowercased and international names converted to ASCII. Create and detail responses include:

```json
{
  "dns": {
    "ownership": { "type": "TXT", "name": "_utpx-verification.links.example.com", "value": "utpx_verify_<unique-token>" },
    "routing": { "type": "CNAME", "name": "links.example.com", "value": "your-configured-target.example" }
  }
}
```

DNS instruction names are full hostnames; some DNS dashboards expect names relative to the zone. Both records must match exactly. Verification returns 200 with `isVerified` and `checks: { ownership, routing }`; missing/mismatched records leave the domain unverified. DNS timeouts/outages return 503 for retry and do not change stored status. Re-verification with a definite mismatch clears prior verification. Checks are explicit, not continuously monitored. Keep the TXT record in place.

Use an unproxied subdomain CNAME (DNS-only in Cloudflare). Apex flattening/proxied CNAMEs are not supported by this verifier. Set `CUSTOM_DOMAIN_TARGET` to the actual redirect ingress hostname. DNS verification does not register the hostname with Render/Vercel or issue an HTTPS certificate: the hosting/reverse-proxy layer must also accept the domain and provision TLS. Preserve the original Host header; tenant selection intentionally ignores X-Forwarded-Host.

`POST /links` now accepts optional numeric `domainId`. It must be verified and belong to the signed-in user. The returned `shortLink` uses `https://<custom-domain>/<shortCode>`. Short codes remain globally unique. A custom host only redirects links assigned to that exact verified domain; primary `BACK_END_URL` links remain compatible.

Deleting a domain with links or a bio page returns 409 instead of cascading deletion into links/analytics. Detach the bio page (`domainId: null`) and delete attached short links before removing the domain.
