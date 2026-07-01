import { prisma } from "../../lib/db.js";

const getPublicStats = async () => {
     const [totalUsers, totalLinks, totalClicks] = await Promise.all([
          prisma.user.count(),
          prisma.link.count(),
          prisma.clickEvent.count(),
     ]);

     return { totalUsers, totalLinks, totalClicks };
};

export default {
     GetPublicStatsService: getPublicStats,
};
