import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { ApiError } from "../utils/api_error.js";

export const errHandler = (err, req, res, next) => {
     let error = err;

     if (!(error instanceof ApiError)) {
          let statusCode = error.statusCode || 500;
          let message = error.message || "Something went wrong";

          if (error instanceof PrismaClientKnownRequestError) {
               statusCode = 400;
               if (error.code === "P2002") {
                    message = "A record with this value already exists.";
               } else if (error.code === "P2025") {
                    message = "Record not found.";
               }
          }

          error = new ApiError(
               statusCode,
               message,
               error?.errors || [],
               error.stack,
          );
     }

     console.log(error);

     const response = {
          ...error,
          message: error.message,
          ...(process.env.NODE_ENV === "development"
               ? { stack: error.stack }
               : {}),
     };

     return res.status(error?.statusCode).json(response);
};