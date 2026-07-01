import { rateLimit, ipKeyGenerator } from "express-rate-limit";

const _15Mins = 15 * 60 * 1000;
const _10Mins = 10 * 60 * 1000;

export const RateLimiter = ({
     windowTimeInMs = _15Mins,
     limit = 250,
     message = "Too many requests. Please try again later.",
     keyGenerator = (req, res) => ipKeyGenerator(req.ip, 56),
} = {}) => {
     return rateLimit({
          windowMs: windowTimeInMs,
          max: limit,
          message,
          keyGenerator,
     });
};

const makeLimiter = (
     limit,
     windowMs,
     useUserId = false,
     useIp = true,
     userEmail = false,
     message = "Too many attempts, try again later."
) => {
     return RateLimiter({
          keyGenerator: (req, res) => {
               if (useUserId && req.user?._id) return req.user._id.toString();
               if (useIp) return ipKeyGenerator(req.ip, 56);
               if (req.body.email) return req.body.email;
          },
          limit,
          windowTimeInMs: windowMs,
          message,
     });
};

const rateLimiterConfig = {
     registerLimiter: [20, _10Mins, false, true, false, "Too many registration attempts. Please try again after 10 minutes."],
     verifyLimiter: [20, _10Mins, false, false, true, "Too many verification attempts. please try after some time"],
     loginLimiter: [15, _10Mins, false, true, false, "Too many login attempts. Please wait 10 minutes before retrying."],
     googleLimiter: [20, _15Mins, false, true, false, "Too many Google login attempts. Try again after 15 minutes."],

     sendOTPLimiter: [40, _15Mins, false, false, true, "Too many send otp attempts. Please try again after 15 minutes."]
};



export const limiter = Object.fromEntries(
     Object.entries(rateLimiterConfig).map(([key, value]) => [
          key,
          makeLimiter(...value),
     ])
);