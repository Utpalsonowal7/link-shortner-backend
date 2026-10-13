import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

const asyncHandler = <Body = unknown>(requestHandler: (
     req: Request<ParamsDictionary, unknown, Body>,
     res: Response<unknown>,
     next: NextFunction,
) => unknown | Promise<unknown>): RequestHandler<ParamsDictionary, unknown, Body> => {
     return (req, res, next) => {
          Promise
               .resolve()
               .then(() => requestHandler(req, res, next))
               .catch((err) => next(err));
     };
};

export { asyncHandler };
