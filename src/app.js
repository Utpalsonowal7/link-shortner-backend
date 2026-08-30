import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import logger from "./utils/logger.js";
import { client } from "./lib/redis.js";
import { otpKey } from "./utils/otpKey.js";
import { errHandler } from "./middlewares/errHandler.middleware.js";
import { clientDetails } from "./middlewares/metaData.middleware.js";

const app = express();

app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "16kb", extended: true }));
app.use(express.static("public"));
app.use(cookieParser());

app.use(
     cors({
          origin: process.env.CORS_ORIGIN.split(","),
          credentials: true,
          methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          allowHeaders: ["Content-Type", "Authorization"],
     }),
);

const morganFormat = ":method :url :status :response-time ms";
app.use(
     morgan(morganFormat, {
          stream: {
               write: (message) => {
                    const logObject = {
                         method: message.split(" ")[0],
                         url: message.split(" ")[1],
                         status: message.split(" ")[2],
                         responseTime: message.split(" ")[3],
                    };
                    logger.info(JSON.stringify(logObject));
               },
          },
     }),
);

app.use(clientDetails);

import healthCheckRoute from "./routes/healthCheck.route.js";
import authRoute from "./routes/auth.routes.js";
import linkRoutes, { redirectRouterExport } from "./routes/link.routes.js";
import qrRoutes from "./routes/qr.routes.js";
import statsRouter from "./routes/stats.route.js";
import paymentRouter from "./routes/payment.routes.js";
import domainRouter from "./routes/domain.routes.js";
import { apiRouter, redirectRouter } from "./routes/temp.routes.js";

app.use("/api/v1/auth", authRoute);
app.use("/api/v1/links", linkRoutes);
app.use("/api/v1/qr", qrRoutes);
app.use("/api/v1/stats", statsRouter);
app.use("/api/v1/temp", apiRouter);
app.use("/api/v1/order", paymentRouter);
app.use("/api/v1/domain", domainRouter);
app.use("/", healthCheckRoute);
app.use("/", redirectRouterExport);
app.use("/", redirectRouter);

app.use(errHandler);

export default app;
