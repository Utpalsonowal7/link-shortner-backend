import { ApiError } from "../utils/api_error.js";
import { ZodError } from "zod";

export const validate = (schema, props = "body") => {
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
