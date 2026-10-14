import { linkQuerySchema, type CreateLinkInput } from "../validators/linkSchema.js";
import { requireUser, queryString, routeParam } from "../utils/request.js";
import { LinkServices } from "../services/index.js";
import { asyncHandler } from "../utils/async_handler.js";
import { ApiResponse } from "../utils/api_response.js";

const createLink = asyncHandler<CreateLinkInput>(async (req, res) => {
     const link = await LinkServices.CreateLinkService(req.body, requireUser(req).id);

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
          requireUser(req).id,
          linkQuerySchema.parse(req.query),
     );

     return res
          .status(200)
          .json(new ApiResponse(200, result, "Links fetched successfully"));
});

const getLinkById = asyncHandler(async (req, res) => {
     const range = queryString(req.query.range, "7");

     const link = await LinkServices.GetLinkByIdService(
          routeParam(req, "id"),
          requireUser(req).id,
          range,
     );

     return res
          .status(200)
          .json(new ApiResponse(200, link, "Link fetched successfully"));
});

const deleteLink = asyncHandler(async (req, res) => {
     await LinkServices.DeleteLinkService(routeParam(req, "id"), requireUser(req).id);

     return res
          .status(200)
          .json(new ApiResponse(200, null, "Link deleted successfully"));
});

const getLinkAnalytics = asyncHandler(async (req, res) => {
     const analytics = await LinkServices.GetLinkAnalyticsService(
          routeParam(req, "id"),
          requireUser(req).id,
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
     const shortCode = routeParam(req, "shortCode");

     try {
          const clientInfo = {
               ip: req.clientInfo.ipAddress,
               device: req.clientInfo.device,
               browser: req.clientInfo.browser,
               os: req.clientInfo.os,
               referrer: req.headers["referer"] || null,
               agent: req.clientInfo.agent,
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

          res.redirect(longUrl);
          return;
     } catch (error) {
          if (error instanceof Error && error.message === "This link has expired") {
               return res.redirect(`${process.env.FRONTEND_URL}/link-expired`);
          }
          throw error;
     }
});

const verifyAndRedirect = asyncHandler<{ q: string; password: string }>(async (req, res) => {
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
     const stats = await LinkServices.GetUserStatsService(Number(requireUser(req).id));

     return res
          .status(200)
          .json(new ApiResponse(200, stats, "Stats fetched successfully"));
});

const editLink = asyncHandler<{ password: string }>(async (req, res) => {
     const { password } = req.body;
     const id = routeParam(req, "id");

     await LinkServices.EditLinkService(password, id, requireUser(req).id);

     return res
          .status(200)
          .json(new ApiResponse(200, {}, "Link edited successfully"));
});

const homeData = asyncHandler(async (req, res) => {
     const data = await LinkServices.HomePageDataService(requireUser(req).id);

     return res
          .status(200)
          .json(new ApiResponse(200, { data }, "Data fetch successfully"));
});

const userLinks = asyncHandler(async (req, res) => {
     const links = await LinkServices.UserLinksServices(
          requireUser(req).id,
          queryString(req.query.q),
          queryString(req.query.cursor),
     );

     return res
          .status(200)
          .json(new ApiResponse(200, { links }, "Links Fetched Successfully"));
});

const userQr = asyncHandler(async (req, res) => {
     const qr = await LinkServices.UserQrServices(requireUser(req).id);

     return res
          .status(200)
          .json(new ApiResponse(200, { qr }, "Links Fetched Successfully"));
});

const overallAnalytics = asyncHandler(async (req, res) => {
     const range = queryString(req.query.range, "7");

     const analytcs = await LinkServices.OverAllAnalyticsService(
          requireUser(req).id,
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
