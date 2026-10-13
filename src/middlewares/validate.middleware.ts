import { ApiError } from "../utils/api_error.js";
import { ZodError, type ZodType } from "zod";
import type { RequestHandler } from "express";

export const validate = (schema: ZodType, props: "body" | "query" | "params" = "body"): RequestHandler => {

     return async (req, res, next) => {

          try {
               const data = await schema.parseAsync(req[props]);
               if (props === "body") {
                    req[props] = data;
               }
               next();
          } catch (error) {
               if (error instanceof ZodError) {
                    const extractedError = error?.issues?.map((err) => {
                         return `${err.path.join(".")} : ${err.message}`;
                    });

                    return next(
                         new ApiError(
                              422,
                              "Provided data is not valid",
                              extractedError,
                         ),
                    );
               }
               next(error);
          }
     };
};
