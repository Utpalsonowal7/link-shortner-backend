import { ApiError } from "../utils/api_error.js";
import { asyncHandler } from "../utils/async_handler.js";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/db.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
     const token = req.cookies?.accessToken || req.header('Authorization')?.replace('Bearer ', "");

     if (!token) {
          throw new ApiError(401,"Unauthorized request")
     };

     try {
          const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
          const user = await prisma.user.findUnique({
               where: {
                    email: decodedToken.email
               },
               omit: {
                    password: true
               }
          });

          if (!user) {
               throw new ApiError(401, "Invalid access Token")
          };

          req.user = user;
          next();
     } catch (err) {
          throw new ApiError(401, "Invalid access Token")
     }
});