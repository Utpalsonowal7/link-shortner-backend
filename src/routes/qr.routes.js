import { Router } from "express";
import QrController from "../controllers/qr.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { limiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

router.route("/qr-generate").post(verifyJWT, limiter.qrGenerateLimiter, upload.single("image"), QrController.generateQr);

export default router;
