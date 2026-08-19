import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
     destination: function (req, file, cb) {
          cb(null, "./public/images");
     },
     filename: function (req, file, cb) {
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
     fileFilter: (req, file, cb) => {
          const acceptType = ["image/jpeg", "image/png"];

          if (acceptType.includes(file.mimetype)) {
               cb(null, true);
          } else {
               cb(new Error("invalid file type"), false);
          }
     },
});
