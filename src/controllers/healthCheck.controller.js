import { ApiResponse } from "../utils/api_response.js";
import { asyncHandler } from "../utils/async_handler.js";

export const healthCheck = asyncHandler(async (req, res) => {
     const uptime = process.uptime();

     return res.status(200).json(
          new ApiResponse(
               200,
               {
                    uptime: `${Math.floor(uptime / 60)} minutes and ${Math.floor(uptime % 60)} seconds`,
                    currentTime: new Date().toISOString(),
               },
               "Application is running"
          )
     );
});

