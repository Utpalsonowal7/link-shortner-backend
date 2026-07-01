import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createLinkSchema, linkQuerySchema } from "../validators/linkSchema.js";
import linkController from "../controllers/link.controller.js";

const router = Router();


router
     .route("/")
     .post(verifyJWT, validate(createLinkSchema), linkController.createLink)
     .get(
          verifyJWT,
          validate(linkQuerySchema, "query"),
          linkController.getUserLinks,
);
     
router.route("/stats").get(verifyJWT, linkController.getUserStats);

router
     .route("/:id")
     .get(verifyJWT, linkController.getLinkById)
     .delete(verifyJWT, linkController.deleteLink);

router.route("/:id/analytics").get(verifyJWT, linkController.getLinkAnalytics);

export default router;


export const redirectRouterExport = Router().get(
     "/:shortCode",
     linkController.redirectLink,
);
