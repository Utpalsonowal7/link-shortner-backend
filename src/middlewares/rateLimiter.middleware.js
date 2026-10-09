import { createHash } from "node:crypto";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { client } from "../lib/redis.js";

const MINUTE = 60 * 1000;

const incrementScript = `
local count = redis.call("INCR", KEYS[1])
local ttl = redis.call("PTTL", KEYS[1])
if count == 1 or ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = ARGV[1]
end
return { count, ttl }
`;

const decrementScript = `
local count = redis.call("DECR", KEYS[1])
if count <= 0 then
  redis.call("DEL", KEYS[1])
end
return count
`;

class RedisFixedWindowStore {
     constructor(prefix) {
          this.prefix = `rate-limit:${prefix}:`;
          this.windowMs = 15 * MINUTE;
          this.localKeys = false;
     }

     init(options) {
          this.windowMs = options.windowMs;
     }

     async increment(key) {
          const [totalHits, ttl] = await client.eval(
               incrementScript,
               1,
               `${this.prefix}${key}`,
               String(this.windowMs),
          );

          return {
               totalHits: Number(totalHits),
               resetTime: new Date(Date.now() + Math.max(0, Number(ttl))),
          };
     }

     async decrement(key) {
          await client.eval(decrementScript, 1, `${this.prefix}${key}`);
     }

     async resetKey(key) {
          await client.del(`${this.prefix}${key}`);
     }
}

const ipKey = (req) => ipKeyGenerator(req.ip || "unknown", 56);

const emailAndIpKey = (req) => {
     const email = String(req.body?.email || "").trim().toLowerCase();
     const emailHash = email
          ? createHash("sha256").update(email).digest("hex")
          : "missing-email";

     return `${ipKey(req)}:email:${emailHash}`;
};

const userAndIpKey = (req) => {
     const userId = req.user?.id ?? req.user?._id;
     return userId
          ? `${ipKey(req)}:user:${String(userId)}`
          : ipKey(req);
};

const createLimiter = ({
     name,
     limit,
     windowMs,
     keyGenerator = ipKey,
     message = "Too many requests. Please try again later.",
}) =>
     rateLimit({
          windowMs,
          limit,
          keyGenerator,
          store: new RedisFixedWindowStore(name),
          standardHeaders: "draft-8",
          legacyHeaders: false,
          passOnStoreError: true,
          message: { message },
     });

const limiter = {
     apiLimiter: createLimiter({
          name: "api",
          limit: 600,
          windowMs: 15 * MINUTE,
          message: "API request limit reached. Please try again shortly.",
     }),
     publicStatsLimiter: createLimiter({
          name: "public-stats",
          limit: 120,
          windowMs: 15 * MINUTE,
     }),
     registerLimiter: createLimiter({
          name: "auth-register",
          limit: 8,
          windowMs: 15 * MINUTE,
          keyGenerator: emailAndIpKey,
          message: "Too many registration attempts. Please try again in 15 minutes.",
     }),
     verifyLimiter: createLimiter({
          name: "auth-verify-otp",
          limit: 10,
          windowMs: 10 * MINUTE,
          keyGenerator: emailAndIpKey,
          message: "Too many verification attempts. Please try again later.",
     }),
     sendOTPLimiter: createLimiter({
          name: "auth-send-otp",
          limit: 3,
          windowMs: 15 * MINUTE,
          keyGenerator: emailAndIpKey,
          message: "Too many OTP requests. Please try again in 15 minutes.",
     }),
     loginLimiter: createLimiter({
          name: "auth-login",
          limit: 10,
          windowMs: 15 * MINUTE,
          keyGenerator: emailAndIpKey,
          message: "Too many login attempts. Please wait before retrying.",
     }),
     googleLimiter: createLimiter({
          name: "auth-google",
          limit: 20,
          windowMs: 15 * MINUTE,
     }),
     forgotPasswordLimiter: createLimiter({
          name: "auth-forgot-password",
          limit: 5,
          windowMs: 15 * MINUTE,
          keyGenerator: emailAndIpKey,
          message: "Too many password reset requests. Please try again later.",
     }),
     resetPasswordLimiter: createLimiter({
          name: "auth-reset-password",
          limit: 10,
          windowMs: 15 * MINUTE,
          keyGenerator: emailAndIpKey,
          message: "Too many password reset attempts. Please try again later.",
     }),
     refreshLimiter: createLimiter({
          name: "auth-refresh",
          limit: 60,
          windowMs: 15 * MINUTE,
          message: "Too many token refresh requests. Please try again shortly.",
     }),
     changePasswordLimiter: createLimiter({
          name: "auth-change-password",
          limit: 5,
          windowMs: 15 * MINUTE,
          keyGenerator: userAndIpKey,
          message: "Too many password change attempts. Please try again later.",
     }),
     linkCreateLimiter: createLimiter({
          name: "link-create",
          limit: 30,
          windowMs: 15 * MINUTE,
          keyGenerator: userAndIpKey,
          message: "Too many links created. Please try again shortly.",
     }),
     linkVerifyLimiter: createLimiter({
          name: "link-password-verify",
          limit: 10,
          windowMs: 15 * MINUTE,
          message: "Too many password attempts for links. Please try again later.",
     }),
     analyticsLimiter: createLimiter({
          name: "analytics",
          limit: 120,
          windowMs: 15 * MINUTE,
          keyGenerator: userAndIpKey,
          message: "Too many analytics requests. Please try again shortly.",
     }),
     writeLimiter: createLimiter({
          name: "write",
          limit: 60,
          windowMs: 15 * MINUTE,
          keyGenerator: userAndIpKey,
          message: "Too many changes requested. Please try again shortly.",
     }),
     qrGenerateLimiter: createLimiter({
          name: "qr-generate",
          limit: 10,
          windowMs: 15 * MINUTE,
          keyGenerator: userAndIpKey,
          message: "Too many QR code requests. Please try again later.",
     }),
     tempCreateLimiter: createLimiter({
          name: "temp-link-create",
          limit: 10,
          windowMs: 15 * MINUTE,
          message: "Too many temporary links created. Please try again later.",
     }),
     paymentCreateLimiter: createLimiter({
          name: "payment-create",
          limit: 5,
          windowMs: 15 * MINUTE,
          message: "Too many payment orders created. Please try again later.",
     }),
     paymentVerifyLimiter: createLimiter({
          name: "payment-verify",
          limit: 30,
          windowMs: 15 * MINUTE,
          message: "Too many payment verification attempts. Please try again later.",
     }),
};

export { limiter };
