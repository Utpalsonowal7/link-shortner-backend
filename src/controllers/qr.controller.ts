import { ApiError } from "../utils/api_error.js";
import { createQrSchema } from "../validators/linkSchema.js";
import { requireUser } from "../utils/request.js";
import { asyncHandler } from "../utils/async_handler.js";
import { ApiResponse } from "../utils/api_response.js";
import { QrService } from "../services/index.js";

const generateQr = asyncHandler<{ form: string }>(async (req, res) => {

     let parsed: unknown;
     try { parsed = JSON.parse(req.body.form); }
     catch { throw new ApiError(400, "Invalid QR form"); }
     const result = createQrSchema.safeParse(parsed);
     if (!result.success) throw new ApiError(422, "Provided data is not valid", result.error.issues.map(issue => `${issue.path.join(".")} : ${issue.message}`));
     const form = result.data;
     if (!req.file) throw new ApiError(400, "QR image is required");
     const file = req.file.path;

     await QrService.QrGenerateService(form, file, requireUser(req).id);

     return res
          .status(201)
          .json(new ApiResponse(201, "Qr created successfully"));
});

export default { generateQr };
