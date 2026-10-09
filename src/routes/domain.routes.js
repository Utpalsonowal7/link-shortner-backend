import { Router } from "express";

import domainController from "../controllers/domain.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { limiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

router.use(verifyJWT);

router
     .route("/")
     .post(limiter.writeLimiter, domainController.createDomain)
     .get(domainController.getUserDomains);

router
     .route("/:id")
     .get( domainController.getDomainById)
     .delete(limiter.writeLimiter, domainController.deleteDomain);

export default router;
