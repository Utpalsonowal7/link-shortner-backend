import { Router } from "express";
import statsController from "../controllers/stats.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/").get(statsController.getPublicStats);
router.route("/top-stats").get(verifyJWT, statsController.getTopStats);

export default router;
