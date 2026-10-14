import Router from "express";
import {
     createOrder,
     verifyPayment,
} from "../controllers/payment.controller.js";

const router = Router();

router.route("/create-order").post(createOrder);
router.route("/verify-payment").post(verifyPayment);

export default router;
