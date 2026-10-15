import { domainToASCII } from "node:url";
import { isIP } from "node:net";
import { ApiError } from "./api_error.js";

export function normalizeDomain(value: unknown): string {
    if (typeof value !== "string") throw new ApiError(422, "A hostname is required");
    const input = value.trim().toLowerCase().replace(/\.$/, "");
    // Hostnames only: no schemes, ports, credentials, paths or wildcard records.
    if (/[\s/:@?#*\\]/.test(input)) throw new ApiError(422, "Enter a hostname without a URL scheme or path");
    const host = domainToASCII(input);
    if (!host || host.length > 253 || isIP(host) || !host.includes(".") ||
        !host.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
        !/[a-z]/.test(host.split(".").at(-1)!)) {
        throw new ApiError(422, "Invalid public hostname");
    }
    return host;
}
