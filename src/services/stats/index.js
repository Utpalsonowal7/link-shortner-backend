import { prisma } from "../../lib/db.js";

const getPublicStats = async () => {
     const [totalUsers, totalLinks, totalClicks] = await Promise.all([
          prisma.user.count(),
          prisma.link.count(),
          prisma.clickEvent.count(),
     ]);

     console.log(totalClicks);
     return { totalUsers, totalLinks, totalClicks };
};

const getTopAndRecentLinks = async (userId) => {
     const [top5Links, recent5Clikcs] = await Promise.all([
          prisma.link.findMany({
               where: { userId: Number(userId) },
               orderBy: { totalClicks: "desc" },
               take: 5,
          }),

          prisma.clickEvent.findMany({
               where: {
                    link: {
                         userId: Number(userId),
                    },
               },
               include: {
                    link: {
                         select: {
                              shortCode: true,
                         },
                    },
               },
               orderBy: {
                    timestamp: "desc",
               },
               take: 5,
          }),
     ]);

     return { top5Links, recent5Clikcs };
};

export default {
     GetPublicStatsService: getPublicStats,
     GetTopAndRecentLinksServices: getTopAndRecentLinks,
};
