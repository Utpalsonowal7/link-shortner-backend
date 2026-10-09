import { Router } from "express";
import statsController from "../controllers/stats.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { limiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

router.route("/").get(limiter.publicStatsLimiter, statsController.getPublicStats);
router.route("/top-stats").get(verifyJWT, statsController.getTopStats);

export default router;
