import { TempService } from "../services/index.js";
import { ApiResponse } from "../utils/api_response.js";
import { asyncHandler } from "../utils/async_handler.js";

const tempUrl = asyncHandler(async (req, res) => {
     const { longUrl, shortCode } = req.body;

     const rel = await TempService.TempUrlService(longUrl, shortCode);

     return res
          .status(201)
          .json(
               new ApiResponse(
                    201,
                    { rel },
                    "temp link ceated and will expired after a hour",
               ),
          );
});

const redirectUrl = asyncHandler(async (req, res) => {
     const { shortCode } = req.params;

     const resp = await TempService.TempredirectService(shortCode);

     if (!resp) {
           return res.redirect(`${process.env.FRONTEND_URL}/link-expired`);
     }

     return res.redirect(resp);
});

export default {
     tempUrl,
     redirectUrl,
};
