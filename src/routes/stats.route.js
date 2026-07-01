import { Router } from "express";
import statsController from "../controllers/stats.controller.js";

const router = Router();

router.route("/").get(statsController.getPublicStats);

export default router;
