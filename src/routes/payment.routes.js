import Router from "express";
import { limiter } from "../middlewares/rateLimiter.middleware.js";
import {
     createOrder,
     verifyPayment,
} from "../controllers/payment.controller.js";

const router = Router();

router.route("/create-order").post(limiter.paymentCreateLimiter, createOrder);
router.route("/verify-payment").post(limiter.paymentVerifyLimiter, verifyPayment);

export default router;
