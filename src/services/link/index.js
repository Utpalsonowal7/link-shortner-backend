import { prisma } from "../../lib/db.js";
import { ApiError } from "../../utils/api_error.js";
import { generateUniqueShortCode } from "./uniqueCode.js";
import { getClientGeoInfo } from "../geo.service.js";

const createLink = async (data, userId) => {
     const { longUrl, title, tags } = data;

     const shortCode = await generateUniqueShortCode();

     const link = await prisma.link.create({
          data: {
               shortCode,
               longUrl,
               title: title ?? null,
               expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
               tags: tags ?? [],
               userId,
          },
     });

     return link;
};

const getUserLinks = async (userId, query = {}) => {
     const { page = 1, limit = 20, search } = query;
   
     const where = {
          userId,
          ...(search && {
               OR: [
                    { title: { contains: search, mode: "insensitive" } },
                    { shortCode: { contains: search, mode: "insensitive" } },
                    { longUrl: { contains: search, mode: "insensitive" } },
               ],
          }),
     };

     const [links, total] = await Promise.all([
          prisma.link.findMany({
               where,
               orderBy: { createdAt: "desc" },
               skip: (page - 1) * limit,
               take: Number(limit),
          }),
          prisma.link.count({ where }),
     ]);

     return {
          links,
          pagination: {
               total,
               page: Number(page),
               limit: Number(limit),
               totalPages: Math.ceil(total / limit),
          },
     };
};

const getLinkById = async (id, userId) => {
     const link = await prisma.link.findUnique({
          where: { id: Number(id) },
     });

     if (!link) {
          throw new ApiError(404, "Link not found");
     }

     if (link.userId !== userId) {
          throw new ApiError(403, "You do not have access to this link");
     }

     return link;
};


const deleteLink = async (id, userId) => {
     await getLinkById(id, userId);

     await prisma.link.delete({
          where: { id: Number(id) },
     });
};

const resolveAndTrack = async (shortCode, clientInfo) => {
     const link = await prisma.link.findUnique({
          where: { shortCode },
     });

     if (!link) {
          throw new ApiError(404, "Link not found");
     }

     if (!link.isActive) {
          throw new ApiError(410, "This link has been deactivated");
     }

     if (link.expiresAt && link.expiresAt < new Date()) {
          throw new ApiError(410, "This link has expired");
     }

     trackClick(link.id, clientInfo).catch((err) => {
          console.error("Click tracking failed:", err.message);
     });

     return link.longUrl;
};

const trackClick = async (linkId, clientInfo) => {
     const { ip, referrer, device, browser, os } = clientInfo;
     console.log(ip);
     const geo = await getClientGeoInfo(ip);

     await prisma.$transaction([
          prisma.clickEvent.create({
               data: {
                    linkId,
                    ip: ip ?? null,
                    referrer: referrer ?? null,
                    device: device ?? null,
                    browser: browser ?? null,
                    os: os ?? null,
                    ...geo,
               },
          }),
          prisma.link.update({
               where: { id: linkId },
               data: { totalClicks: { increment: 1 } },
          }),
     ]);
};

const getLinkAnalytics = async (id, userId) => {
     await getLinkById(id, userId); 

     const [link, clicksByCountry, clicksByDevice, recentClicks] =
          await Promise.all([
               prisma.link.findUnique({ where: { id: Number(id) } }),
               prisma.clickEvent.groupBy({
                    by: ["country"],
                    where: { linkId: Number(id) },
                    _count: { country: true },
                    orderBy: { _count: { country: "desc" } },
               }),
               prisma.clickEvent.groupBy({
                    by: ["device"],
                    where: { linkId: Number(id) },
                    _count: { device: true },
               }),
               prisma.clickEvent.findMany({
                    where: { linkId: Number(id) },
                    orderBy: { timestamp: "desc" },
                    take: 50,
               }),
          ]);

     return {
          link,
          totalClicks: link.totalClicks,
          clicksByCountry,
          clicksByDevice,
          recentClicks,
     };
};


const getUserStats = async (userId) => {
     const startOfToday = new Date();
     startOfToday.setHours(0, 0, 0, 0);

     const startOfYesterday = new Date(startOfToday);
     startOfYesterday.setDate(startOfYesterday.getDate() - 1);

     const startOfThisMonth = new Date();
     startOfThisMonth.setDate(1);
     startOfThisMonth.setHours(0, 0, 0, 0);

     const startOfLastMonth = new Date(startOfThisMonth);
     startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

     const whereToday = {
          link: { userId: Number(userId) },
          timestamp: { gte: startOfToday },
     };
     const whereYesterday = {
          link: { userId: Number(userId) },
          timestamp: { gte: startOfYesterday, lt: startOfToday },
     };
     const whereThisMonth = {
          link: { userId: Number(userId) },
          timestamp: { gte: startOfThisMonth },
     };
     const whereLastMonth = {
          link: { userId: Number(userId) },
          timestamp: { gte: startOfLastMonth, lt: startOfThisMonth },
     };

     const [
          totalLinks,
          totalClicks,
          clicksToday,
          clicksYesterday,
          activeLinks,
          linksThisMonth,
          linksLastMonth,
          clicksThisMonth,
          clicksLastMonth,
          topLinkToday,
          topCountryToday,
          topReferrerToday,
          topDeviceToday,
     ] = await Promise.all([
          prisma.link.count({ where: { userId: Number(userId) } }),
          prisma.clickEvent.count({
               where: { link: { userId: Number(userId) } },
          }),
          prisma.clickEvent.count({ where: whereToday }),
          prisma.clickEvent.count({ where: whereYesterday }),
          prisma.link.count({
               where: { userId: Number(userId), isActive: true },
          }),
          prisma.link.count({
               where: {
                    userId: Number(userId),
                    createdAt: { gte: startOfThisMonth },
               },
          }),
          prisma.link.count({
               where: {
                    userId: Number(userId),
                    createdAt: { gte: startOfLastMonth, lt: startOfThisMonth },
               },
          }),
          prisma.clickEvent.count({ where: whereThisMonth }),
          prisma.clickEvent.count({ where: whereLastMonth }),
          prisma.clickEvent.groupBy({
               by: ["linkId"],
               where: whereToday,
               _count: { linkId: true },
               orderBy: { _count: { linkId: "desc" } },
               take: 1,
          }),
          prisma.clickEvent.groupBy({
               by: ["country"],
               where: { ...whereToday, country: { not: null } },
               _count: { country: true },
               orderBy: { _count: { country: "desc" } },
               take: 1,
          }),
          prisma.clickEvent.groupBy({
               by: ["referrer"],
               where: { ...whereToday, referrer: { not: null } },
               _count: { referrer: true },
               orderBy: { _count: { referrer: "desc" } },
               take: 1,
          }),
          prisma.clickEvent.groupBy({
               by: ["device"],
               where: { ...whereToday, device: { not: null } },
               _count: { device: true },
               orderBy: { _count: { device: "desc" } },
               take: 1,
          }),
     ]);

     // compute deltas
     const deltaPercent = (current, previous) => {
          if (!previous) return null;
          return Math.round(((current - previous) / previous) * 100);
     };

     // resolve top link
     let topLink = null;
     if (topLinkToday[0]) {
          const link = await prisma.link.findUnique({
               where: { id: topLinkToday[0].linkId },
               select: { shortCode: true },
          });
          topLink = {
               shortUrl: `${process.env.SHORT_DOMAIN}/${link.shortCode}`,
               clicksToday: topLinkToday[0]._count.linkId,
          };
     }

     return {
          totalLinks,
          totalClicks,
          clicksToday,
          activeLinks,
          linksThisMonth,

          // deltas for stat cards
          deltas: {
               clicksToday: deltaPercent(clicksToday, clicksYesterday),
               clicksThisMonth: deltaPercent(clicksThisMonth, clicksLastMonth),
               linksThisMonth: linksThisMonth - linksLastMonth,
          },

          highlights: {
               topLink,
               topCountry: topCountryToday[0]
                    ? {
                           name: topCountryToday[0].country,
                           percent: Math.round(
                                (topCountryToday[0]._count.country /
                                     (clicksToday || 1)) *
                                     100,
                           ),
                      }
                    : null,
               topReferrer: topReferrerToday[0]
                    ? {
                           name: topReferrerToday[0].referrer,
                           percent: Math.round(
                                (topReferrerToday[0]._count.referrer /
                                     (clicksToday || 1)) *
                                     100,
                           ),
                      }
                    : null,
               topDevice: topDeviceToday[0]
                    ? {
                           name: topDeviceToday[0].device,
                           percent: Math.round(
                                (topDeviceToday[0]._count.device /
                                     (clicksToday || 1)) *
                                     100,
                           ),
                      }
                    : null,
          },
     };
};

export default {
     CreateLinkService: createLink,
     GetUserLinksService: getUserLinks,
     GetLinkByIdService: getLinkById,
     DeleteLinkService: deleteLink,
     ResolveAndTrackService: resolveAndTrack,
     GetLinkAnalyticsService: getLinkAnalytics,
     GetUserStatsService: getUserStats,
};
