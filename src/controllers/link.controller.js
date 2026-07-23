import { LinkServices } from "../services/index.js";
import { asyncHandler } from "../utils/async_handler.js";
import { ApiResponse } from "../utils/api_response.js";

const createLink = asyncHandler(async (req, res) => {
     const link = await LinkServices.CreateLinkService(req.body, req.user.id);
     console.log(link);
     const shortLink = `${process.env.BACK_END_URL}${link.shortCode}`;

     return res
          .status(201)
          .json(
               new ApiResponse(
                    201,
                    { ...link, shortLink },
                    "Link created successfully",
               ),
          );
});

const getUserLinks = asyncHandler(async (req, res) => {
     const result = await LinkServices.GetUserLinksService(
          req.user.id,
          req.query,
     );

     return res
          .status(200)
          .json(new ApiResponse(200, result, "Links fetched successfully"));
});

const getLinkById = asyncHandler(async (req, res) => {
     const link = await LinkServices.GetLinkByIdService(
          req.params.id,
          req.user.id,
     );

     return res
          .status(200)
          .json(new ApiResponse(200, link, "Link fetched successfully"));
});

const updateLink = asyncHandler(async (req, res) => {
     const link = await LinkServices.UpdateLinkService(
          req.params.id,
          req.user.id,
          req.body,
     );

     return res
          .status(200)
          .json(new ApiResponse(200, link, "Link updated successfully"));
});

const deleteLink = asyncHandler(async (req, res) => {
     await LinkServices.DeleteLinkService(req.params.id, req.user.id);

     return res
          .status(200)
          .json(new ApiResponse(200, null, "Link deleted successfully"));
});

const getLinkAnalytics = asyncHandler(async (req, res) => {
     const analytics = await LinkServices.GetLinkAnalyticsService(
          req.params.id,
          req.user.id,
     );

     return res
          .status(200)
          .json(
               new ApiResponse(
                    200,
                    analytics,
                    "Analytics fetched successfully",
               ),
          );
});

const redirectLink = asyncHandler(async (req, res) => {
     const { shortCode } = req.params;

     const clientInfo = {
          ip: req.clientInfo.ipAddress,
          device: req.clientInfo.device,
          browser: req.clientInfo.browser,
          os: req.clientInfo.os,
          referrer: req.headers["referer"] || null,
     };

     const longUrl = await LinkServices.ResolveAndTrackService(
          shortCode,
          clientInfo,
     );

     if (!longUrl) {
          return res.redirect(
               `http://localhost:5173/protectedlink?q=${shortCode}`,
          );
     }

     return res.redirect(longUrl);
});

const verifyAndRedirect = asyncHandler(async (req, res) => {
   
     const { q, password } = req.body;

     const clientInfo = {
          ip: req.clientInfo.ipAddress,
          device: req.clientInfo.device,
          browser: req.clientInfo.browser,
          os: req.clientInfo.os,
          referrer: req.headers["referer"] || null,
     };

     const longUrl = await LinkServices.VerifyLinkPasswordService(
          q,
          password,
          clientInfo,
     );

     console.log(longUrl)

     return res.status(200).json(
          new ApiResponse(200, longUrl, "sending...")
     )
});

const getUserStats = asyncHandler(async (req, res) => {
     const stats = await LinkServices.GetUserStatsService(Number(req.user.id));

     return res
          .status(200)
          .json(new ApiResponse(200, stats, "Stats fetched successfully"));
});

const editLink = asyncHandler(async (req, res) => {
     const { password } = req.body;
     const { id } = req.params;

     await LinkServices.EditLinkService(password, id);

     return res
          .status(200)
          .json(new ApiResponse(200, {}, "Link edited successfully"));
});

export default {
     createLink,
     getUserLinks,
     getLinkById,
     updateLink,
     deleteLink,
     getLinkAnalytics,
     redirectLink,
     getUserStats,
     editLink,
     verifyAndRedirect
};
