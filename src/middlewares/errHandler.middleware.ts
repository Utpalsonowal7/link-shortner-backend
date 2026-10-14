import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import type { ErrorRequestHandler } from "express";
import { ApiError } from "../utils/api_error.js";
import { errorMessage, errorStatus } from "../utils/errors.js";

export const errHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
    if (res.headersSent) return next(err);
    let error: ApiError;
    if (err instanceof ApiError) {
        error = err;
    } else {
        let statusCode = errorStatus(err);
        let message = errorMessage(err);
        if (err instanceof PrismaClientKnownRequestError) {
            statusCode = 400;
            if (err.code === "P2002") message = "A record with this value already exists.";
            else if (err.code === "P2025") message = "Record not found.";
        }
        error = new ApiError(statusCode, message, [], err instanceof Error ? err.stack : undefined);
    }
    return res.status(error.statusCode).json({
        statusCode: error.statusCode,
        data: error.data,
        success: error.success,
        errors: error.errors,
        message: error.message,
        ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
    });
};
