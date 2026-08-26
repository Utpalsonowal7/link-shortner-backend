import { asyncHandler } from "../utils/async_handler.js";
import { ApiResponse } from "../utils/api_response.js";
import { QrService } from "../services/index.js";

const generateQr = asyncHandler(async (req, res) => {
  
     const form = JSON.parse(req.body.form);
     const file = req.file.path;

     await QrService.QrGenerateService(form, file, req.user.id);

     return res
          .status(201)
          .json(new ApiResponse(201, "Qr created successfully"));
});

export default { generateQr };
