import { TempService } from "../services/index.js";
import { ApiResponse } from "../utils/api_response.js";
import { asyncHandler } from "../utils/async_handler.js";

const tempUrl = asyncHandler(async (req, res) => {
     
     const { longUrl, customCode } = req.body;
    

     const rel = await TempService.TempUrlService(longUrl, customCode);

     return res
          .status(201)
          .json(
               new ApiResponse(
                    201,
                    { rel },
                    "Temp link ceated and will expired after 5 min",
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
