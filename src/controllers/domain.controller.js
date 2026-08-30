import { ApiResponse } from "../utils/api_response.js";
import { asyncHandler } from "../utils/async_handler.js";
import DomainService from "../services/domain/index.js";

const createDomain = asyncHandler(async (req, res) => {
     const { domain } = req.body;

     const userId = req.user.id;

     const result = await DomainService.CreateDomainService(userId, domain);

     return res
          .status(201)
          .json(new ApiResponse(201, result, "Domain added successfully"));
});

const getUserDomains = asyncHandler(async (req, res) => {
     const userId = req.user.id;

     const domains = await DomainService.GetDomainUser(userId);

     return res
          .status(200)
          .json(
               new ApiResponse(
                    200,
                    { domains },
                    "Domains fetched successfully",
               ),
          );
});

const getDomainById = asyncHandler(async (req, res) => {
     const userId = req.user.id;

     const domainId = Number(req.params.id);

     const domain = await DomainService.GetDomainByIf(userId, domainId);

     return res
          .status(200)
          .json(
               new ApiResponse(200, { domain }, "Domain fetched successfully"),
          );
});

const deleteDomain = asyncHandler(async (req, res) => {
     const userId = req.user.id;

     const domainId = Number(req.params.id);

     const result = await DomainService.DeleteDomain(userId, domainId);

     return res
          .status(200)
          .json(new ApiResponse(200, result, "Domain deleted successfully"));
});

export default { createDomain, getUserDomains, getDomainById, deleteDomain };