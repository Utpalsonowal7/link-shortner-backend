import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createLinkSchema, linkQuerySchema } from "../validators/linkSchema.js";
import linkController from "../controllers/link.controller.js";
import { limiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

router
     .route("/")
     .post(verifyJWT, limiter.linkCreateLimiter, validate(createLinkSchema), linkController.createLink)
     .get(
          verifyJWT,
          validate(linkQuerySchema, "query"),
          linkController.getUserLinks,
     );

router.route("/verify").post(limiter.linkVerifyLimiter, linkController.verifyAndRedirect);

router.route("/home-data").get(verifyJWT, limiter.analyticsLimiter, linkController.homeData);
router.route("/user-links").get(verifyJWT, linkController.userLinks);
router.route("/user-qrs").get(verifyJWT, linkController.userQr);
router.route("/stats").get(verifyJWT, limiter.analyticsLimiter, linkController.getUserStats);
router
     .route("/overall-analytcs")
     .get(verifyJWT, limiter.analyticsLimiter, linkController.overallAnalytics);

router.route("/:id").post(verifyJWT, limiter.writeLimiter, linkController.editLink);

router
     .route("/:id")
     .get(verifyJWT, linkController.getLinkById)
     .delete(verifyJWT, limiter.writeLimiter, linkController.deleteLink);

router.route("/:id/analytics").get(verifyJWT, limiter.analyticsLimiter, linkController.getLinkAnalytics);

export default router;

export const redirectRouterExport = Router().get(
     "/:shortCode",
     linkController.redirectLink,
);
