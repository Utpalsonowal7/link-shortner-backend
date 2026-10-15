import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createBioSchema, updateBioSchema, type CreateBioInput, type UpdateBioInput } from "../validators/bioSchema.js";
import { idParams } from "../validators/domainSchema.js";
import { asyncHandler } from "../utils/async_handler.js";
import { requireUser, routeParam } from "../utils/request.js";
import { ApiResponse } from "../utils/api_response.js";
import { normalizeDomain } from "../utils/domain.js";
import * as service from "../services/bio/index.js";

export const publicBioRouter = Router();
publicBioRouter.get("/domain/:domain", asyncHandler(async (req, res) => {
    const page = await service.publicBio({ domain: { domain: normalizeDomain(routeParam(req, "domain")), isVerified: true } });
    res.set("Cache-Control", "no-store").json(new ApiResponse(200, page, "Bio page"));
}));
publicBioRouter.get("/:slug", asyncHandler(async (req, res) => {
    const page = await service.publicBio({ slug: routeParam(req, "slug").toLowerCase() });
    res.set("Cache-Control", "no-store").json(new ApiResponse(200, page, "Bio page"));
}));
const router = Router();
router.use(verifyJWT);
router.get("/", asyncHandler(async (req, res) => { res.json(new ApiResponse(200, await service.listBios(requireUser(req).id), "Bio pages")); }));
router.post("/", validate(createBioSchema), asyncHandler<CreateBioInput>(async (req, res) => {
    res.status(201).json(new ApiResponse(201, await service.createBio(requireUser(req).id, req.body), "Bio page created"));
}));
router.use("/:id", validate(idParams, "params"));
router.get("/:id", asyncHandler(async (req, res) => {
    res.json(new ApiResponse(200, await service.getBio(requireUser(req).id, Number(routeParam(req, "id"))), "Bio page"));
}));
router.patch("/:id", validate(updateBioSchema), asyncHandler<UpdateBioInput>(async (req, res) => {
    res.json(new ApiResponse(200, await service.updateBio(requireUser(req).id, Number(routeParam(req, "id")), req.body), "Bio page updated"));
}));
router.delete("/:id", asyncHandler(async (req, res) => {
    await service.deleteBio(requireUser(req).id, Number(routeParam(req, "id")));
    res.json(new ApiResponse(200, null, "Bio page deleted"));
}));
export default router;
