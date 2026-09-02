import { prisma } from "../../lib/db.js";
import { ApiError } from "../../utils/api_error.js";
import { generateUniqueShortCode } from "./uniqueCode.js";
import { getClientGeoInfo } from "../geo.service.js";
import bcrypt, { hash } from "bcrypt";
import { ApiResponse } from "../../utils/api_response.js";
import { KpiCard } from "../../utils/kpiCard.js";

const createLink = async (data, userId) => {
     const {
          longUrl,
          title,
          tags,
          customCode,
          password,
          expiresAt,
          utmSource,
          utmMedium,
          utmCampaign,
          utmTerm,
          utmContent,
     } = data;

     const shortCode = customCode
          ? customCode
          : await generateUniqueShortCode();

     const pass = password ? await bcrypt.hash(password, 10) : null;

     const link = await prisma.link.create({
          data: {
               shortCode,
               longUrl,
               title: title ?? null,
               expiresAt: expiresAt ?? null,
               tags: tags ?? [],
               userId,
               password: pass,
               utmSource,
               utmMedium,
               utmCampaign,
               utmTerm,
               utmContent,
          },
          select: {
               shortCode: true,
               longUrl: true,
          },
     });

     return link;
};

// const getUserLinks = async (userId, query = {}) => {
//      const { page = 1, limit = 20, search } = query;

//      const where = {
//           userId,
//           ...(search && {
//                OR: [
//                     { title: { contains: search, mode: "insensitive" } },
//                     { shortCode: { contains: search, mode: "insensitive" } },
//                     { longUrl: { contains: search, mode: "insensitive" } },
//                ],
//           }),
//      };

//      const [links, total] = await Promise.all([
//           prisma.link.findMany({
//                where,
//                orderBy: { createdAt: "desc" },
//                skip: (page - 1) * limit,
//                take: Number(limit),
//           }),
//           prisma.link.count({ where }),
//      ]);

//      return {
//           links,
//           pagination: {
//                total,
//                page: Number(page),
//                limit: Number(limit),
//                totalPages: Math.ceil(total / limit),
//           },
//      };
// };

// const getLinkById = async (id, userId) => {
//      const link = await prisma.link.findUnique({
//           where: { id: Number(id) },
//      });

//      if (!link) {
//           throw new ApiError(404, "Link not found");
//      }

//      if (link.userId !== userId) {
//           throw new ApiError(403, "You do not have access to this link");
//      }

//      return link;
// };

const deleteLink = async (id, userId) => {
     await prisma.link.delete({
          where: { id: Number(id), userId: userId },
     });
};

const resolveAndTrack = async (shortCode, clientInfo) => {
     const dbStart = performance.now();

     const link = await prisma.link.findUnique({
          where: { shortCode },
     });

     if (process.env.DEBUG_PERFORMANCE === "true") {
          console.log(
               `DB findUnique: ${(performance.now() - dbStart).toFixed(2)} ms`,
          );
     }

     if (!link) {
          throw new ApiError(404, "Link not found");
     }

     if (!link.isActive) {
          throw new ApiError(410, "This link has been deactivated");
     }

     if (link.expiresAt && link.expiresAt < new Date()) {
          throw new ApiError(410, "This link has expired");
     }

     if (link.is_password_protected) {
          return;
     }

     trackClick(
          link.id,
          clientInfo,
          link.utmSource,
          link.utmMedium,
          link.utmCampaign,
     ).catch((err) => {
          console.error("Click tracking failed:", err.message);
     });

     const buildLongUrlWithUtm = (link) => {
          const url = new URL(link.longUrl);

          if (link.utmSource)
               url.searchParams.set("utm_source", link.utmSource);
          if (link.utmMedium)
               url.searchParams.set("utm_medium", link.utmMedium);
          if (link.utmCampaign)
               url.searchParams.set("utm_campaign", link.utmCampaign);

          return url.toString();
     };

     const longUrl = buildLongUrlWithUtm(link);

     return longUrl;
};

const verifyAndRedirect = async (shortCode, password, clientInfo) => {
     const link = await prisma.link.findUnique({
          where: {
               shortCode: shortCode,
          },
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

     const isPassValid = await bcrypt.compare(password, link.password);

     if (!isPassValid) {
          throw new ApiError(400, "Invalid credentials");
     }

     trackClick(link.id, clientInfo).catch((err) => {
          console.error("Error saving analytics", err.message);
     });

     return link.longUrl;
};

const trackClick = async (
     linkId,
     clientInfo,
     utmSource,
     utmMedium,
     utmCampaign,
     utmContent,
) => {
     const { ip, referrer, device, browser, os } = clientInfo;

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
                    utmSource,
                    utmMedium,
                    utmCampaign,
                    utmContent,
                    ...geo,
               },
          }),
          prisma.link.update({
               where: { id: linkId },
               data: { totalClicks: { increment: 1 } },
          }),
     ]);
};

const getLinkAnalytics = async (id, userId, query = {}) => {
     await getLinkById(id, userId);

     const { range = "7d" } = query;
     const days = range === "30d" ? 30 : range === "24h" ? 1 : 7;

     const since = new Date();
     since.setDate(since.getDate() - days);

     const startOfToday = new Date();
     startOfToday.setHours(0, 0, 0, 0);

     const [
          link,
          clicksByCountry,
          clicksByDevice,
          clicksByOs,
          clicksByContinent,
          recentClicks,
          clicksInRange,
          clicksToday,
          uniqueCountries,
          clicksByCities,
          clicksByRegion,
     ] = await Promise.all([
          prisma.link.findUnique({ where: { id: Number(id) } }),

          prisma.clickEvent.groupBy({
               by: ["country"],
               where: { linkId: Number(id) },
               _count: { country: true },
               orderBy: { _count: { country: "desc" } },
               take: 5,
          }),

          prisma.clickEvent.groupBy({
               by: ["device"],
               where: { linkId: Number(id) },
               _count: { device: true },
               orderBy: { _count: { device: "desc" } },
          }),

          prisma.clickEvent.groupBy({
               by: ["os"],
               where: { linkId: Number(id), os: { not: null } },
               _count: { os: true },
               orderBy: { _count: { os: "desc" } },
               take: 5,
          }),

          prisma.clickEvent.groupBy({
               by: ["continent"],
               where: { linkId: Number(id), continent: { not: null } },
               _count: { continent: true },
               orderBy: { _count: { continent: "desc" } },
          }),

          prisma.clickEvent.findMany({
               where: { linkId: Number(id) },
               orderBy: { timestamp: "desc" },
               take: 20,
          }),

          prisma.clickEvent.findMany({
               where: { linkId: Number(id), timestamp: { gte: since } },
               select: { timestamp: true },
          }),

          prisma.clickEvent.count({
               where: { linkId: Number(id), timestamp: { gte: startOfToday } },
          }),

          prisma.clickEvent.findMany({
               where: { linkId: Number(id), country: { not: null } },
               select: { country: true },
               distinct: ["country"],
          }),

          prisma.clickEvent.groupBy({
               by: ["city"],
               where: { linkId: Number(id), city: { not: null } },
               _count: { city: true },
               orderBy: { _count: { city: "desc" } },
               take: 5,
          }),

          prisma.clickEvent.groupBy({
               by: ["region"],
               where: { linkId: Number(id), region: { not: null } },
               _count: { region: true },
               orderBy: { _count: { region: "desc" } },
               take: 5,
          }),
     ]);

     // time series bucketing
     const buckets = {};
     for (let i = 0; i < days; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          buckets[key] = 0;
     }
     clicksInRange.forEach((c) => {
          const key = c.timestamp.toISOString().slice(0, 10);
          if (buckets[key] !== undefined) buckets[key]++;
     });
     const timeSeries = Object.entries(buckets)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));

     // avg per day since link was created
     const daysSinceCreated = Math.max(
          1,
          Math.ceil(
               (Date.now() - new Date(link.createdAt).getTime()) /
                    (1000 * 60 * 60 * 24),
          ),
     );
     const avgPerDay = Math.round(link.totalClicks / daysSinceCreated);

     return {
          link: {
               ...link,
               shortUrl: `${process.env.BACK_END_URL}${link.shortCode}`,
          },
          totalClicks: link.totalClicks,
          clicksToday,
          avgPerDay,
          uniqueCountries: uniqueCountries.length,
          clicksByCountry,
          clicksByDevice,
          clicksByOs,
          clicksByContinent,
          recentClicks,
          timeSeries,
          clicksByCities,
          clicksByRegion,
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

     const deltaPercent = (current, previous) => {
          if (!previous) return null;
          return Math.round(((current - previous) / previous) * 100);
     };

     let topLink = null;
     if (topLinkToday[0]) {
          const link = await prisma.link.findUnique({
               where: { id: topLinkToday[0].linkId },
               select: { shortCode: true },
          });
          topLink = {
               shortUrl: `${process.env.BACK_END_URL}${link.shortCode}`,
               clicksToday: topLinkToday[0]._count.linkId,
          };
     }

     return {
          totalLinks,
          totalClicks,
          clicksToday,
          activeLinks,
          linksThisMonth,

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

const homePageData = async (userId) => {
     const today = new Date();
     today.setHours(0, 0, 0, 0);

     const tomorrow = new Date(today);
     tomorrow.setDate(today.getDate() + 1);

     const yesterday = new Date(today);
     yesterday.setDate(today.getDate() - 1);

     const twentyFourHoursAgo = new Date();
     twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

     const [
          todayClicks,
          yesterdayClicks,
          todayLinks,
          yesterdayLinks,
          todayUniqueVisitors,
          yesterdayUniqueVisitors,
          todayCountriesReached,
          yesterdayCountriesReached,
          clisksByHour,
          topCountries,
          topLinks,
          topCities,
     ] = await Promise.all([
          prisma.clickEvent.count({
               where: {
                    timestamp: {
                         gte: today,
                         lt: tomorrow,
                    },
                    link: {
                         userId: Number(userId),
                    },
               },
          }),

          prisma.clickEvent.count({
               where: {
                    timestamp: {
                         gte: yesterday,
                         lt: today,
                    },
                    link: {
                         userId: Number(userId),
                    },
               },
          }),

          prisma.link.count({
               where: {
                    createdAt: {
                         gte: today,
                         lt: tomorrow,
                    },
                    userId: Number(userId),
               },
          }),

          prisma.link.count({
               where: {
                    createdAt: {
                         gte: yesterday,
                         lt: today,
                    },
                    userId: Number(userId),
               },
          }),

          prisma.clickEvent.findMany({
               distinct: ["ip"],
               select: {
                    ip: true,
               },
               where: {
                    timestamp: {
                         gte: today,
                         lt: tomorrow,
                    },
                    link: {
                         userId: Number(userId),
                    },
               },
          }),

          prisma.clickEvent.findMany({
               distinct: ["ip"],
               select: {
                    ip: true,
               },
               where: {
                    timestamp: {
                         gte: yesterday,
                         lt: today,
                    },
                    link: {
                         userId: Number(userId),
                    },
               },
          }),

          prisma.clickEvent.findMany({
               distinct: ["country"],
               select: {
                    country: true,
               },
               where: {
                    timestamp: {
                         gte: today,
                         lt: tomorrow,
                    },
                    link: {
                         userId: Number(userId),
                    },
               },
          }),

          prisma.clickEvent.findMany({
               distinct: ["country"],
               select: {
                    country: true,
               },
               where: {
                    timestamp: {
                         gte: yesterday,
                         lt: today,
                    },
                    link: {
                         userId: Number(userId),
                    },
               },
          }),

          prisma.$queryRaw`
               SELECT
                      DATE_TRUNC('hour', c."timestamp") AS hour,
                      COUNT(*) AS clicks
                      FROM click_events c
                      JOIN links l
                      ON c."linkId" = l.id
                     WHERE
                      c."timestamp" >= NOW() - INTERVAL '24 hours'
                     AND l."userId" = ${userId}
                    GROUP BY hour
                     ORDER BY hour;
                     `,

          // prisma.clickEvent.groupBy({
          //      by: ["linkId"],
          //      where: {
          //           timestamp: {
          //                gte: today,
          //                lt: tomorrow,
          //           },
          //           linkId: {
          //                not: null,
          //           },
          //           link: {
          //                userId: Number(userId),
          //           },
          //      },
          //      _count: {
          //           linkId: true,
          //      },
          //      orderBy: {
          //           _count: {
          //                country: "desc",
          //           },
          //      },
          //      include: {
          //           links: {
          //                sh,
          //           },
          //      },
          //      take: 5,
          // }),

          prisma.clickEvent.groupBy({
               by: ["country"],
               where: {
                    timestamp: {
                         gte: today,
                         lt: tomorrow,
                    },
                    country: {
                         not: null,
                    },
                    link: {
                         userId: Number(userId),
                    },
               },
               _count: {
                    country: true,
               },
               orderBy: {
                    _count: {
                         country: "desc",
                    },
               },
               take: 5,
          }),

          prisma.$queryRaw`
          select l."linkId", count(*)::int as clicks , c."shortCode" , c."longUrl" 
          from click_events as l 
           join links c 
          on c.id = l."linkId" 
           where c."userId" = ${userId} and l."timestamp" >= ${today}   AND l."timestamp" < ${tomorrow}
          group by "linkId", c."shortCode", c."longUrl" 
            order by clicks desc
              limit 5
           ;
          `,

          prisma.clickEvent.groupBy({
               by: ["city"],
               where: {
                    timestamp: {
                         gte: today,
                         lt: tomorrow,
                    },
                    city: {
                         not: null,
                    },
                    link: {
                         userId: Number(userId),
                    },
               },
               _count: {
                    city: true,
               },
               orderBy: {
                    _count: {
                         city: "desc",
                    },
               },
               take: 5,
          }),
     ]);

     const kpiData = [
          new KpiCard(1, "Today's Clicks", todayClicks, yesterdayClicks),
          new KpiCard(2, "Links/Qr Created", todayLinks, yesterdayLinks),
          new KpiCard(
               3,
               "Unique Visitors",
               todayUniqueVisitors.length,
               yesterdayUniqueVisitors.length,
          ),
          new KpiCard(
               4,
               "Countries Reached",
               todayCountriesReached.length,
               yesterdayCountriesReached.length,
          ),
     ];

     const formattedClicksByHour = clisksByHour.map((item) => ({
          name: item.hour.toISOString().slice(11, 16),
          clicks: Number(item.clicks),
     }));

     const formattedCountries = topCountries.map((item) => ({
          name: item.country,
          value: item._count.country,
     }));

     const formattedCities = topCities.map((item) => ({
          name: item.city,
          value: item._count.city,
     }));

     const formattedTopLinks = topLinks.map((link) => ({
          ...link,
          clicks: Number(link.clicks),
          shortUrl: `${process.env.BACK_END_URL?.replace(/\/$/, "")}/${link.shortCode}`,
     }));

     return {
          kpiData,
          clisksByHour: formattedClicksByHour,
          topCountries: formattedCountries,
          topLinks: formattedTopLinks,
          topCities: formattedCities,
     };
};

const getLinksUser = async (userId) => {
     const links = await prisma.link.findMany({
          where: {
               userId: userId,
               qrUrl: null,
          },
          select: {
               id: true,
               shortCode: true,
               longUrl: true,
               title: true,
          },
          orderBy: { createdAt: "desc" },
          take: 150,
     });

     const linkFormatter = links.map((l) => ({
          ...l,
          title:
               l.title ||
               `${new URL(l.longUrl).hostname.replace(/^www\./, "")} - Untitled`,
          shortUrl: `${process.env.BACK_END_URL?.replace(/\/$/, "")}/${l.shortCode}`,
     }));

     return {
          links: linkFormatter,
     };
};

const getUserQr = async (userId) => {
     const links = await prisma.link.findMany({
          where: {
               userId: userId,
               qrUrl: {
                    not: null,
               },
          },
          select: {
               id: true,
               shortCode: true,
               longUrl: true,
               title: true,
               qrUrl: true,
          },
          take: 150,
     });

     const linkFormatter = links.map((l) => {
          let hostname = "Unknown";

          if (l.longUrl) {
               try {
                    hostname = new URL(l.longUrl).hostname.replace(
                         /^www\./,
                         "",
                    );
               } catch {
                    hostname = "Unknown";
               }
          }

          return {
               ...l,
               title: l.title || `${hostname} - Untitled`,
               shortUrl: `${process.env.BACK_END_URL?.replace(/\/$/, "")}/${l.shortCode}`,
          };
     });

     return {
          qr: linkFormatter,
     };
};

const getLinkById = async (id, userId, range = "7") => {
     // const link = await prisma.link.findFirst({
     //      where: {
     //           id: Number(id),
     //           userId: Number(userId),
     //      },
     // });

     let startDate = null;

     if (range === "7") {
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
     } else if (range === "30") {
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);
     } else if (range !== "all") {
          throw new ApiError(400, "Invalid analytics range");
     }

     console.log({
          id,
          userId,
          startDate,
          idNumber: Number(id),
          userIdNumber: Number(userId),
     });
     const result = await prisma.$queryRaw`
    SELECT
        l.id,
        l."longUrl",
        l."shortCode",
        l.title,
        l.tags,
        l."createdAt",
        l."expiresAt",
        l."isActive",
        l."is_password_protected",

        (
            SELECT COUNT(*)
            FROM click_events ce
            WHERE ce."linkId" = l.id
              AND (${startDate}::timestamp IS NULL OR ce.timestamp >= ${startDate})
        ) AS "totalClicks",

        (
            SELECT COUNT(DISTINCT ce.ip)
            FROM click_events ce
            WHERE ce."linkId" = l.id
              AND ce.ip IS NOT NULL
              AND (${startDate}::timestamp IS NULL OR ce.timestamp >= ${startDate})
        ) AS "uniqueVisitors",

        (
            SELECT COUNT(DISTINCT ce.country)
            FROM click_events ce
            WHERE ce."linkId" = l.id
              AND ce.country IS NOT NULL
              AND (${startDate}::timestamp IS NULL OR ce.timestamp >= ${startDate})
        ) AS countries,

        (
            SELECT ce.timestamp
            FROM click_events ce
            WHERE ce."linkId" = l.id
              AND (${startDate}::timestamp IS NULL OR ce.timestamp >= ${startDate})
            ORDER BY ce.timestamp DESC
            LIMIT 1
        ) AS "lastClicked",

        (
            SELECT COALESCE(
                ROUND(
                    COUNT(*)::numeric /
                    NULLIF(COUNT(DISTINCT DATE(ce.timestamp)), 0),
                    2
                ),
                0
            )
            FROM click_events ce
            WHERE ce."linkId" = l.id
              AND (${startDate}::timestamp IS NULL OR ce.timestamp >= ${startDate})
        ) AS "avgDailyClicks",

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'name', x.day,
                        'clicks', x.clicks
                    )
                    ORDER BY x.date
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    DATE(ce.timestamp) AS date,
                    TO_CHAR(DATE(ce.timestamp), 'Mon DD') AS day,
                    COUNT(*) AS clicks
                FROM click_events ce
                WHERE ce."linkId" = l.id
                  AND (${startDate}::timestamp IS NULL OR ce.timestamp >= ${startDate})
                GROUP BY DATE(ce.timestamp)
            ) x
        ) AS "clickTrend",

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'name', x.country,
                        'value', x.value
                    )
                    ORDER BY x.value DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    COALESCE(ce.country, 'Unknown') AS country,
                    COUNT(*) AS value
                FROM click_events ce
                WHERE ce."linkId" = l.id
                  AND (${startDate}::timestamp IS NULL OR ce.timestamp >= ${startDate})
                GROUP BY COALESCE(ce.country, 'Unknown')
            ) x
        ) AS "countriesData",

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'name', x.device,
                        'value', x.value
                    )
                    ORDER BY x.value DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    COALESCE(ce.device, 'Unknown') AS device,
                    COUNT(*) AS value
                FROM click_events ce
                WHERE ce."linkId" = l.id
                  AND (${startDate}::timestamp IS NULL OR ce.timestamp >= ${startDate})
                GROUP BY COALESCE(ce.device, 'Unknown')
            ) x
        ) AS devices,

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'name', x.city,
                        'value', x.value
                    )
                    ORDER BY x.value DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    COALESCE(ce.city, 'Unknown') AS city,
                    COUNT(*) AS value
                FROM click_events ce
                WHERE ce."linkId" = l.id
                  AND (${startDate}::timestamp IS NULL OR ce.timestamp >= ${startDate})
                GROUP BY COALESCE(ce.city, 'Unknown')
            ) x
        ) AS cities,

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'name', x.os,
                        'value', x.value
                    )
                    ORDER BY x.value DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    COALESCE(ce.os, 'Unknown') AS os,
                    COUNT(*) AS value
                FROM click_events ce
                WHERE ce."linkId" = l.id
                  AND (${startDate}::timestamp IS NULL OR ce.timestamp >= ${startDate})
                GROUP BY COALESCE(ce.os, 'Unknown')
            ) x
        ) AS os,

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'name', x.browser,
                        'value', x.value
                    )
                    ORDER BY x.value DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    COALESCE(ce.browser, 'Unknown') AS browser,
                    COUNT(*) AS value
                FROM click_events ce
                WHERE ce."linkId" = l.id
                  AND (${startDate}::timestamp IS NULL OR ce.timestamp >= ${startDate})
                GROUP BY COALESCE(ce.browser, 'Unknown')
            ) x
        ) AS browsers,

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'source', x.referrer,
                        'clicks', x.clicks
                    )
                    ORDER BY x.clicks DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    COALESCE(ce.referrer, 'Direct') AS referrer,
                    COUNT(*) AS clicks
                FROM click_events ce
                WHERE ce."linkId" = l.id
                  AND (${startDate}::timestamp IS NULL OR ce.timestamp >= ${startDate})
                GROUP BY COALESCE(ce.referrer, 'Direct')
            ) x
        ) AS referrers,

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'timestamp', ce.timestamp,
                        'country', COALESCE(ce.country, 'Unknown'),
                        'city', COALESCE(ce.city, 'Unknown'),
                        'browser', COALESCE(ce.browser, 'Unknown'),
                        'device', COALESCE(ce.device, 'Unknown'),
                        'referrer', COALESCE(ce.referrer, 'Direct')
                    )
                    ORDER BY ce.timestamp DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT *
                FROM click_events
                WHERE "linkId" = l.id
                  AND (${startDate}::timestamp IS NULL OR timestamp >= ${startDate})
                ORDER BY timestamp DESC
                LIMIT 10
            ) ce
        ) AS "recentClicks"

    FROM links l
    WHERE l.id = ${Number(id)}
      AND l."userId" = ${Number(userId)}
    LIMIT 1;
`;

     const data = result[0];

     if (!data) {
          throw new ApiError(404, "Link not found");
     }
     return {
          id: data.id,
          shortCode: data.shortCode,
          title:
               data.title ||
               `${new URL(data.longUrl).hostname.replace(/^www\./, "")} - Untitled`,
          shortUrl: `${process.env.BACK_END_URL?.replace(/\/$/, "")}/${data.shortCode}`,
          longUrl: data.longUrl,
          status: data.isActive ? "Active" : "Inactive",
          createdAt: new Date(data.createdAt).toLocaleString("en-IN", {
               day: "2-digit",
               month: "short",
               year: "numeric",
               hour: "2-digit",
               minute: "2-digit",
          }),
          expiresAt: data.expiresAt
               ? new Date(data.expiresAt).toLocaleString("en-IN")
               : "Never",
          passwordProtected: data.is_password_protected,
          tags: data.tags,
          analytics: {
               totalClicks: Number(data.totalClicks),
               uniqueVisitors: Number(data.uniqueVisitors),
               avgDailyClicks: Number(data.avgDailyClicks),
               countries: Number(data.countries),
               clickTrend: data.clickTrend,
               countriesData: data.countriesData,
               devices: data.devices,
               cities: data.cities,
               os: data.os,
               browsers: data.browsers,
               referrers: data.referrers,
               recentClicks: data.recentClicks,
          },
     };
     // if (!link) {
     //      throw new ApiError(404, "Link not found");
     // }

     //  const linkFormatter = {
     //       ...link,
     //       title:
     //            link.title ||
     //            `${new URL(link.longUrl).hostname.replace(/^www\./, "")} - Untitled`,
     //       shortUrl: `${process.env.BACK_END_URL?.replace(/\/$/, "")}/${link.shortCode}`,
     //       createdAt: new Date(link.createdAt).toLocaleString("en-IN", {
     //            day: "2-digit",
     //            month: "short",
     //            year: "numeric",
     //            hour: "2-digit",
     //            minute: "2-digit",
     //       }),
     //  };

     // return linkFormatter;

     // return {
     //      id: data.id,
     //      shortCode:data.shortCode,
     //      title:
     //           data.title ||
     //           `${new URL(data.longUrl).hostname.replace(/^www\./, "")} - Untitled`,
     //      shortUrl: `${process.env.BACK_END_URL?.replace(/\/$/, "")}/${data.shortCode}`,
     //      longUrl: data.longUrl,
     //      status: data.isActive ? "Active" : "Inactive",
     //      createdAt: new Date(data.createdAt).toLocaleString("en-IN", {
     //           day: "2-digit",
     //           month: "short",
     //           year: "numeric",
     //           hour: "2-digit",
     //           minute: "2-digit",
     //      }),
     //      expiresAt: data.expiresAt
     //           ? new Date(data.expiresAt).toLocaleString("en-IN")
     //           : "Never",
     //      passwordProtected: data.is_password_protected,
     //      tags: data.tags,

     //      analytics: {
     //           totalClicks: data.totalClicks,
     //           uniqueVisitors: Number(data.uniqueVisitors),
     //           avgDailyClicks: Number(data.avgDailyClicks),
     //           countries: Number(data.countries),

     //           clickTrend: data.clickTrend,
     //           countriesData: data.countriesData,
     //           devices: data.devices,
     //           cities: data.cities,
     //           os: data.os,
     //           browsers: data.browsers,
     //           referrers: data.referrers,
     //           recentClicks: data.recentClicks,
     //      },
     // };
};

const overallAnalytics = async (userId, range) => {
     let startDate = null;

     if (range === "7") {
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
     }

     if (range === "30") {
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);
     }

     const result = await prisma.$queryRaw`
    SELECT

        (
            SELECT COUNT(*)::int
            FROM links l
            WHERE l."userId" = ${Number(userId)}
        ) AS "totalLinks",

        (
            SELECT COUNT(*)::int
            FROM links l
            WHERE l."userId" = ${Number(userId)}
              AND l."isActive" = true
              AND (
                  l."expiresAt" IS NULL
                  OR l."expiresAt" > NOW()
              )
        ) AS "activeLinks",

        (
            SELECT COUNT(*)::int
            FROM links l
            WHERE l."userId" = ${Number(userId)}
              AND l."isActive" = false
        ) AS "pausedLinks",

        (
            SELECT COUNT(*)::int
            FROM links l
            WHERE l."userId" = ${Number(userId)}
              AND l."expiresAt" IS NOT NULL
              AND l."expiresAt" <= NOW()
        ) AS "expiredLinks",


        /* =========================
           CLICK KPIs
        ========================= */

        (
            SELECT COUNT(*)::int
            FROM click_events ce
            INNER JOIN links l
                ON l.id = ce."linkId"
            WHERE l."userId" = ${Number(userId)}
              AND (
                  ${startDate}::timestamp IS NULL
                  OR ce.timestamp >= ${startDate}
              )
        ) AS "totalClicks",

        (
            SELECT COUNT(DISTINCT ce.ip)::int
            FROM click_events ce
            INNER JOIN links l
                ON l.id = ce."linkId"
            WHERE l."userId" = ${Number(userId)}
              AND ce.ip IS NOT NULL
              AND (
                  ${startDate}::timestamp IS NULL
                  OR ce.timestamp >= ${startDate}
              )
        ) AS "uniqueVisitors",

        (
            SELECT COALESCE(
                ROUND(
                    COUNT(*)::numeric /
                    NULLIF(
                        COUNT(DISTINCT DATE(ce.timestamp)),
                        0
                    ),
                    2
                )::float,
                0
            )
            FROM click_events ce
            INNER JOIN links l
                ON l.id = ce."linkId"
            WHERE l."userId" = ${Number(userId)}
              AND (
                  ${startDate}::timestamp IS NULL
                  OR ce.timestamp >= ${startDate}
              )
        ) AS "avgDailyClicks",

        (
            SELECT COUNT(DISTINCT ce.country)::int
            FROM click_events ce
            INNER JOIN links l
                ON l.id = ce."linkId"
            WHERE l."userId" = ${Number(userId)}
              AND ce.country IS NOT NULL
              AND (
                  ${startDate}::timestamp IS NULL
                  OR ce.timestamp >= ${startDate}
              )
        ) AS "countriesReached",


        /* =========================
           CLICK TREND
        ========================= */

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'name', x.day,
                        'clicks', x.clicks
                    )
                    ORDER BY x.date
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    DATE(ce.timestamp) AS date,
                    TO_CHAR(
                        DATE(ce.timestamp),
                        'Mon DD YYYY'
                    ) AS day,
                    COUNT(*)::int AS clicks
                FROM click_events ce
                INNER JOIN links l
                    ON l.id = ce."linkId"
                WHERE l."userId" = ${Number(userId)}
                  AND (
                      ${startDate}::timestamp IS NULL
                      OR ce.timestamp >= ${startDate}
                  )
                GROUP BY DATE(ce.timestamp)
            ) x
        ) AS "clickTrend",


        /* =========================
           COUNTRIES
        ========================= */

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'name', x.country,
                        'value', x.value
                    )
                    ORDER BY x.value DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    COALESCE(
                        ce.country,
                        'Unknown'
                    ) AS country,
                    COUNT(*)::int AS value
                FROM click_events ce
                INNER JOIN links l
                    ON l.id = ce."linkId"
                WHERE l."userId" = ${Number(userId)}
                  AND (
                      ${startDate}::timestamp IS NULL
                      OR ce.timestamp >= ${startDate}
                  )
                GROUP BY COALESCE(
                    ce.country,
                    'Unknown'
                )
            ) x
        ) AS "countriesData",


        /* =========================
           DEVICES
        ========================= */

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'name', x.device,
                        'value', x.value
                    )
                    ORDER BY x.value DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    COALESCE(
                        ce.device,
                        'Unknown'
                    ) AS device,
                    COUNT(*)::int AS value
                FROM click_events ce
                INNER JOIN links l
                    ON l.id = ce."linkId"
                WHERE l."userId" = ${Number(userId)}
                  AND (
                      ${startDate}::timestamp IS NULL
                      OR ce.timestamp >= ${startDate}
                  )
                GROUP BY COALESCE(
                    ce.device,
                    'Unknown'
                )
            ) x
        ) AS devices,


        /* =========================
           CITIES
        ========================= */

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'name', x.city,
                        'value', x.value
                    )
                    ORDER BY x.value DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    COALESCE(
                        ce.city,
                        'Unknown'
                    ) AS city,
                    COUNT(*)::int AS value
                FROM click_events ce
                INNER JOIN links l
                    ON l.id = ce."linkId"
                WHERE l."userId" = ${Number(userId)}
                  AND (
                      ${startDate}::timestamp IS NULL
                      OR ce.timestamp >= ${startDate}
                  )
                GROUP BY COALESCE(
                    ce.city,
                    'Unknown'
                )
            ) x
        ) AS cities,


        /* =========================
           OS
        ========================= */

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'name', x.os,
                        'value', x.value
                    )
                    ORDER BY x.value DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    COALESCE(
                        ce.os,
                        'Unknown'
                    ) AS os,
                    COUNT(*)::int AS value
                FROM click_events ce
                INNER JOIN links l
                    ON l.id = ce."linkId"
                WHERE l."userId" = ${Number(userId)}
                  AND (
                      ${startDate}::timestamp IS NULL
                      OR ce.timestamp >= ${startDate}
                  )
                GROUP BY COALESCE(
                    ce.os,
                    'Unknown'
                )
            ) x
        ) AS os,


        /* =========================
           BROWSERS
        ========================= */

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'name', x.browser,
                        'value', x.value
                    )
                    ORDER BY x.value DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    COALESCE(
                        ce.browser,
                        'Unknown'
                    ) AS browser,
                    COUNT(*)::int AS value
                FROM click_events ce
                INNER JOIN links l
                    ON l.id = ce."linkId"
                WHERE l."userId" = ${Number(userId)}
                  AND (
                      ${startDate}::timestamp IS NULL
                      OR ce.timestamp >= ${startDate}
                  )
                GROUP BY COALESCE(
                    ce.browser,
                    'Unknown'
                )
            ) x
        ) AS browsers,


        /* =========================
           REFERRERS
        ========================= */

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'source', x.referrer,
                        'clicks', x.clicks
                    )
                    ORDER BY x.clicks DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    COALESCE(
                        ce.referrer,
                        'Direct'
                    ) AS referrer,
                    COUNT(*)::int AS clicks
                FROM click_events ce
                INNER JOIN links l
                    ON l.id = ce."linkId"
                WHERE l."userId" = ${Number(userId)}
                  AND (
                      ${startDate}::timestamp IS NULL
                      OR ce.timestamp >= ${startDate}
                  )
                GROUP BY COALESCE(
                    ce.referrer,
                    'Direct'
                )
            ) x
        ) AS referrers,


        /* =========================
           TOP LINKS
        ========================= */

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', x.id,
                        'desc', x.description,
                        'shortLink', x.shortLink,
                        'clicks', x.clicks
                    )
                    ORDER BY x.clicks DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    l.id,
                    l.title AS description,
                    l."shortCode" AS shortLink,
                    COUNT(ce.id)::int AS clicks
                FROM links l
                LEFT JOIN click_events ce
                    ON ce."linkId" = l.id
                    AND (
                        ${startDate}::timestamp IS NULL
                        OR ce.timestamp >= ${startDate}
                    )
                WHERE l."userId" = ${Number(userId)}
                GROUP BY
                    l.id,
                    l.title,
                    l."shortCode"
                ORDER BY clicks DESC
                LIMIT 5
            ) x
        ) AS "topLinks",


        /* =========================
           RECENT CLICKS
        ========================= */

        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'timestamp', x.timestamp,
                        'country', x.country,
                        'city', x.city,
                        'browser', x.browser,
                        'device', x.device,
                        'referrer', x.referrer
                    )
                    ORDER BY x.timestamp DESC
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT
                    ce.timestamp,
                    COALESCE(
                        ce.country,
                        'Unknown'
                    ) AS country,
                    COALESCE(
                        ce.city,
                        'Unknown'
                    ) AS city,
                    COALESCE(
                        ce.browser,
                        'Unknown'
                    ) AS browser,
                    COALESCE(
                        ce.device,
                        'Unknown'
                    ) AS device,
                    COALESCE(
                        ce.referrer,
                        'Direct'
                    ) AS referrer
                FROM click_events ce
                INNER JOIN links l
                    ON l.id = ce."linkId"
                WHERE l."userId" = ${Number(userId)}
                  AND (
                      ${startDate}::timestamp IS NULL
                      OR ce.timestamp >= ${startDate}
                  )
                ORDER BY ce.timestamp DESC
                LIMIT 10
            ) x
        ) AS "recentClicks"

`;
     if (!result) {
          new ApiResponse(
               200,
               {},
               "Start Creating Links to see your analytcs here",
          );
     }

     return result[0];
};

const editLink = async (password, id) => {
     const hashPassword = await bcrypt.hash(password, 10);

     const res = await prisma.link.update({
          where: {
               id: Number(id),
          },
          data: {
               password: hashPassword,
               is_password_protected: true,
          },
     });

     console.log(res);
};

export default {
     CreateLinkService: createLink,
     // GetUserLinksService: getUserLinks,
     GetLinkByIdService: getLinkById,
     DeleteLinkService: deleteLink,
     ResolveAndTrackService: resolveAndTrack,
     GetLinkAnalyticsService: getLinkAnalytics,
     GetUserStatsService: getUserStats,
     EditLinkService: editLink,
     VerifyLinkPasswordService: verifyAndRedirect,
     HomePageDataService: homePageData,
     UserLinksServices: getLinksUser,
     UserQrServices: getUserQr,
     OverAllAnalyticsService: overallAnalytics,
};
