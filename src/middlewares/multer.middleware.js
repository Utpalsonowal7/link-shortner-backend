import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "public", "images");

if (!fs.existsSync(uploadDir)) {
     fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
     destination: (_req, _file, cb) => {
          cb(null, uploadDir);
     },

     filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now();

          cb(
               null,
               `${uniqueSuffix}_${file.fieldname}${path.extname(file.originalname)}`,
          );
     },
});

export const upload = multer({
     storage,
     limits: {
          fileSize: 1 * 1024 * 1024,
     },
     fileFilter: (_req, file, cb) => {
          const acceptType = ["image/jpeg", "image/png"];

          if (acceptType.includes(file.mimetype)) {
               cb(null, true);
          } else {
               cb(new Error("invalid file type"), false);
          }
     },
});
