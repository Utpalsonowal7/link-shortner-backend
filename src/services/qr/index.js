import { prisma } from "../../lib/db.js";
import { ApiError } from "../../utils/api_error.js";
import { ApiResponse } from "../../utils/api_response.js";
import { generateUniqueShortCode } from "../link/uniqueCode.js";
import { cloudUpload } from "../cloudinary.js";

const createQrCode = async (data, path, userId) => {
     const { longUrl, title, tags, customCode } = data;

     const shortCode = customCode
          ? customCode
          : await generateUniqueShortCode();

     const uploadToCloud = await cloudUpload(path);

     const link = await prisma.link.create({
          data: {
               shortCode,
               longUrl,
               title: title ?? null,
               qrUrl: uploadToCloud.url,
               tags: tags ?? [],
               userId,
          },
          select: {
               shortCode: true,
               longUrl: true,
          },
     });

     return link;
};

export default {
     QrGenerateService: createQrCode,
};
