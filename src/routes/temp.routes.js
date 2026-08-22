import { Router } from "express";
import tempController from "../controllers/temp.controller.js";
import { createLinkSchema } from "../validators/linkSchema.js";
import { validate } from "../middlewares/validate.middleware.js";

const apiRouter = Router();
const redirectRouter = Router();

apiRouter
     .route("/create")
     .post(validate(createLinkSchema), tempController.tempUrl);

redirectRouter.route("/temp/:shortCode").get(tempController.redirectUrl);

export {
     apiRouter,
     redirectRouter
};
