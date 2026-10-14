import { Router } from "express";

import domainController from "../controllers/domain.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router
     .route("/")
     .post(domainController.createDomain)
     .get(domainController.getUserDomains);

router
     .route("/:id")
     .get( domainController.getDomainById)
     .delete( domainController.deleteDomain);

export default router;
