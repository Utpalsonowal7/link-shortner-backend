# Custom domains behind a DNS/CDN proxy

## Verification
Both ownership and routing must pass. TXT still proves ownership using the exact
_utpx-verification token. A visible CNAME matching CUSTOM_DOMAIN_TARGET proves
routing for DNS-only domains. If the CNAME is hidden by a proxy, the server
requests https://CUSTOM_HOST/.well-known/lnkshrt-domain-verification with a fresh
nonce and requires our server's hostname-bound HMAC response.

This is a routing proof, not a certificate issuer or a check of the CDN's
origin TLS mode. It does not grant access to other tenants. Verification never
marks ownership true based on an IP address, a proxy provider, or a 200 page.

The proof endpoint works for registered, not-yet-verified hostnames so verification
is not circular. It uses Host, not X-Forwarded-Host, returns no-store plain text,
and does not expose tokens, secrets, user data, or analytics. Unknown hosts and
invalid nonces are rejected. The probe is attempted only after TXT matches.
Its DNS and network deadlines are bounded. All resolved addresses must be public;
the selected address is pinned for the connection, TLS is verified, redirects
are rejected, and response size is capped. No user-selected URLs, ports,
credentials, environment proxies, or arbitrary paths are accepted.

## Existing EC2/Nginx deployment
Keep API 8080 bound to loopback. The reverse proxy must preserve the original Host
and forward the proof path unchanged to the backend, including the nonce query.
The existing HTTPS Nginx location / reverse_proxy setup already forwards it.
Don't redirect custom-host requests to l.utpx.in or cache the proof endpoint.
Bot challenges or access/login walls must exclude only the proof path.

Cloudflare proxying can provide a browser-facing certificate for hostnames covered
by its edge TLS service. The backend doesn't issue a separate public certificate
when this route is used. Configure the proxy-to-origin connection separately:
Full (strict) requires a valid, trusted certificate for the requested or target
hostname and correct SNI/Host handling. Our l.utpx.in certificate doesn't magically
cover unrelated hostnames. Don't downgrade to Flexible or disable certificate
validation to hide an origin mismatch. Check provider origin-host/SNI settings,
or use managed custom-hostname TLS (e.g. Cloudflare for SaaS) where needed.
If the proxy cannot route securely with the current origin configuration,
per-host certificates or a managed TLS service remain necessary.

For DNS-only direct browser access, this change does not remove the need for a
trusted certificate covering that hostname on Nginx. The application now describes
proxy support rather than telling all users to permanently disable proxying.

## Deployment and verification
1. Merge/deploy this backend change, using the existing RDS-aware compose.aws.yaml.
   Preserve the RDS CA mount and NODE_EXTRA_CA_CERTS settings. No migration needed.
2. Confirm the proof path reaches the backend for the custom Host. Unknown domains
   should return 404; missing/invalid nonce should return 400.
3. Keep the ownership TXT and routing CNAME, enable the customer's supported proxy
   and its edge HTTPS, then run Verify DNS. checks.routingMethod is 'cname' or 'https'.
   Failed proof remains unverified. No certificate is claimed ready merely because
   DNS verified. Test a real link with a normal browser and curl without -k.
4. Merge the companion frontend change to use canonical custom links and update help.

Changing/deleting/unverifying a domain continues to block custom-host redirects
through the existing tenant checks. Link list/detail/analytics URLs retain the
assigned hostname instead of silently showing the main service hostname.

References:
- https://developers.cloudflare.com/dns/proxy-status/use-cases/
- https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/
