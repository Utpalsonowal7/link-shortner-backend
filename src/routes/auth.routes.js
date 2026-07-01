import { Router } from "express";
import {
    registerUser,
    verifyOtp,
    resendOtp,
    loginUser,
    refreshAccessToken,
    googleAuth,
    googleAuthCallback,
    getCurrentUser,
    logOut,
    forgotPassword,
    resetPassword,
    chnagePassword,
} from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
    registerSchema,
    otpSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
} from "../validators/authSchema.js";
import { limiter } from "../middlewares/rateLimiter.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router
    .route("/register")
    .post(limiter.registerLimiter, validate(registerSchema), registerUser);
router
    .route("/verify-otp")
    .post(limiter.verifyLimiter, validate(otpSchema), verifyOtp);
router.route("/resend-otp").post(limiter.sendOTPLimiter, resendOtp);
router.route("/login").post(limiter.loginLimiter, loginUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/google").get(googleAuth);
router.route("/google/callback").get(limiter.loginLimiter, googleAuthCallback);
router
    .route("/forgot-password")
    .post(validate(forgotPasswordSchema), forgotPassword);
router
    .route("/reset-password")
    .post(validate(resetPasswordSchema), resetPassword);

router
    .route("/change-password")
    .patch(verifyJWT, validate(changePasswordSchema), chnagePassword);
router.route("/me").get(verifyJWT, getCurrentUser);
router.route("/logout").post(verifyJWT, logOut);

export default router;
