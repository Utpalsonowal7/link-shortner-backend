import type { Request } from "express";
import { ApiError } from "./api_error.js";

export function requireUser(req: Request) {
    if (!req.user) throw new ApiError(401, "Unauthorized request");
    return req.user;
}

export function queryString(value: unknown, fallback?: string): string | undefined {
    if (value === undefined) return fallback;
    if (typeof value !== "string") throw new ApiError(400, "Expected a single query value");
    return value;
}

export function routeParam(req: Request, name: string): string {
    const value = req.params[name];
    if (typeof value !== "string" || !value) throw new ApiError(400, `Invalid route parameter: ${name}`);
    return value;
}
