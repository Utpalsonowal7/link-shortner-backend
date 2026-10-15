import { validate } from "../middlewares/validate.middleware.js";
import { domainSchema, idParams } from "../validators/domainSchema.js";
import { rateLimit } from "express-rate-limit";
import { Router } from "express";

import domainController from "../controllers/domain.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router
     .route("/")
     .post(validate(domainSchema), domainController.createDomain)
     .get(domainController.getUserDomains);

router.use("/:id", validate(idParams, "params"));
router.post("/:id/verify", rateLimit({ windowMs: 60_000, limit: 10 }), domainController.verifyDomain);

router
     .route("/:id")
     .get( domainController.getDomainById)
     .delete( domainController.deleteDomain);

export default router;
