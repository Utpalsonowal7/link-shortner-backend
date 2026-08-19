import { v2 as cloudinary } from "cloudinary";
import { ApiError } from "../utils/api_error.js";
import fs from "fs";

cloudinary.config({
     cloud_name: process.env.CLOUDNARY_CLOUD_NAME,
     api_key: process.env.CLOUDNARY_API_KEY,
     api_secret: process.env.CLOUDNARY_API_SECRET,
});

export const cloudUpload = async (localFilePath) => {
     try {
          if (!localFilePath) {
               throw new ApiError(400, "Server file not found!");
          }

          console.log("localFilePath:", localFilePath);
          console.log(
               "file exists before cloud upload:",
               fs.existsSync(localFilePath),
          );
          console.log(
               "cloud name exists:",
               Boolean(process.env.CLOUDNARY_CLOUD_NAME),
          );
          console.log(
               "api key exists:",
               Boolean(process.env.CLOUDNARY_API_KEY),
          );
          console.log(
               "api secret exists:",
               Boolean(process.env.CLOUDNARY_API_SECRET),
          );
          const uploadResult = await cloudinary.uploader.upload(localFilePath, {
               resource_type: "auto",
          });

          fs.unlinkSync(localFilePath);
          return uploadResult;
     } catch (error) {
          fs.unlinkSync(localFilePath);
          throw new ApiError(
               error?.statusCode || 500,
               error?.message || "Something went wrong",
          );
     }
};
