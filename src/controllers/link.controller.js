import { LinkServices } from "../services/index.js";
import { asyncHandler } from "../utils/async_handler.js";
import { ApiResponse } from "../utils/api_response.js";
import getClientIp from "../utils/getClientIP.js";

const createLink = asyncHandler(async (req, res) => {
     const link = await LinkServices.CreateLinkService(req.body, req.user.id);

     const shortLink = `${process.env.BACK_END_URL}${link.shortCode}`;

     const { longUrl } = link;

     return res
          .status(201)
          .json(
               new ApiResponse(
                    201,
                    { longUrl, shortLink },
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
     const { range = "7" } = req.query;

     const link = await LinkServices.GetLinkByIdService(
          req.params.id,
          req.user.id,
          range,
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
     const ip = getClientIp(req);
     console.log(ip);
     const { shortCode } = req.params;

     try {
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
                    `${process.env.FRONTEND_URL}/protectedlink?q=${shortCode}`,
               );
          }

          return res.redirect(longUrl);
     } catch (error) {
          if (error.message === "This link has expired") {
               return res.redirect(`${process.env.FRONTEND_URL}/link-expired`);
          }
     }
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

     return res.status(200).json(new ApiResponse(200, longUrl, "sending..."));
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

const homeData = asyncHandler(async (req, res) => {
     const data = await LinkServices.HomePageDataService(req.user.id);

     return res
          .status(200)
          .json(new ApiResponse(200, { data }, "Data fetch successfully"));
});

const userLinks = asyncHandler(async (req, res) => {
     const links = await LinkServices.UserLinksServices(
          req.user.id,
          req.query.q,
     );

     return res
          .status(200)
          .json(new ApiResponse(200, { links }, "Links Fetched Successfully"));
});

const userQr = asyncHandler(async (req, res) => {
     const qr = await LinkServices.UserQrServices(req.user.id);

     return res
          .status(200)
          .json(new ApiResponse(200, { qr }, "Links Fetched Successfully"));
});

const overallAnalytics = asyncHandler(async (req, res) => {
     const { range = "7" } = req.query;

     const analytcs = await LinkServices.OverAllAnalyticsService(
          req.user.id,
          range,
     );

     return res
          .status(200)
          .json(
               new ApiResponse(
                    200,
                    { analytcs },
                    "Analytics Fetched Successfully",
               ),
          );
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
     verifyAndRedirect,
     homeData,
     userLinks,
     overallAnalytics,
     userQr,
};
