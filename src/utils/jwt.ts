import jwt, { type SignOptions } from "jsonwebtoken";
import { requiredEnv } from "./env.js";
import type { UserIdentity } from "../types/index.js";

function tokenExpiry(name: string): NonNullable<SignOptions["expiresIn"]> {
    const value = requiredEnv(name);
    // Match the duration syntax accepted by jsonwebtoken's ms dependency.
    if (!/^-?(?:\d+)?\.?\d+ *(?:milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.test(value)) {
        throw new Error(`Invalid token duration: ${name}`);
    }
    return value as NonNullable<SignOptions["expiresIn"]>;
}

const generateAccessToken = (payload: UserIdentity) => jwt.sign(
    payload, requiredEnv("ACCESS_TOKEN_SECRET"),
    { expiresIn: tokenExpiry("ACCESS_TOKEN_EXPIRES_IN") },
);
const generateRefreshToken = (payload: Pick<UserIdentity, "id">) => jwt.sign(
    payload, requiredEnv("REFRESH_TOKEN_SECRET"),
    { expiresIn: tokenExpiry("REFRESH_TOKEN_EXPIRES_IN") },
);
export { generateAccessToken, generateRefreshToken };
