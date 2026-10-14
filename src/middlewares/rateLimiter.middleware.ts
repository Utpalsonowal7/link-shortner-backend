import { rateLimit, ipKeyGenerator, type Options } from "express-rate-limit";
import type { Request } from "express";

const _15Mins = 15 * 60 * 1000;
const _10Mins = 10 * 60 * 1000;
const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown", 56);

interface LimiterOptions {
    windowTimeInMs?: number;
    limit?: number;
    message?: string;
    keyGenerator?: Options["keyGenerator"];
}
export const RateLimiter = ({
    windowTimeInMs = _15Mins,
    limit = 250,
    message = "Too many requests. Please try again later.",
    keyGenerator = ipKey,
}: LimiterOptions = {}) => rateLimit({ windowMs: windowTimeInMs, max: limit, message, keyGenerator });

const makeLimiter = (
    limit: number,
    windowMs: number,
    useUserId = false,
    useIp = true,
    userEmail = false,
    message = "Too many attempts, try again later.",
) => RateLimiter({
    keyGenerator: (req) => {
        if (useUserId && req.user) return req.user.id.toString();
        if (useIp) return ipKey(req);
        const body: unknown = req.body;
        if (userEmail && typeof body === "object" && body !== null &&
            "email" in body && typeof body.email === "string") return body.email;
        return ipKey(req);
    },
    limit, windowTimeInMs: windowMs, message,
});

export const limiter = {
    registerLimiter: makeLimiter(20, _10Mins, false, true, false, "Too many registration attempts. Please try again after 10 minutes."),
    verifyLimiter: makeLimiter(20, _10Mins, false, false, true, "Too many verification attempts. please try after some time"),
    loginLimiter: makeLimiter(15, _10Mins, false, true, false, "Too many login attempts. Please wait 10 minutes before retrying."),
    googleLimiter: makeLimiter(20, _15Mins, false, true, false, "Too many Google login attempts. Try again after 15 minutes."),
    sendOTPLimiter: makeLimiter(40, _15Mins, false, false, true, "Too many send otp attempts. Please try again after 15 minutes."),
};
