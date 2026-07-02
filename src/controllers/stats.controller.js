import { StatsServices } from "../services/index.js";
import { asyncHandler } from "../utils/async_handler.js";
import { ApiResponse } from "../utils/api_response.js";

const getPublicStats = asyncHandler(async (req, res) => {
     const stats = await StatsServices.GetPublicStatsService();

     return res
          .status(200)
          .json(new ApiResponse(200, stats, "Stats fetched successfully"));
});

const getTopStats = asyncHandler(async (req, res) => {
    
     const stats = await StatsServices.GetTopAndRecentLinksServices(
          req.user.id,
     );

     return res
          .status(200)
          .json(new ApiResponse(200, stats, "Stats fetch successfully"));
});

export default { getPublicStats, getTopStats };
