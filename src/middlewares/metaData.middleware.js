import { getClientInfo } from "../utils/parseDevice.js";

export const clientDetails = (req, res, next) => {
     const userAgent = req.get("user-agent") || "";
     const data = getClientInfo(userAgent);

     console.log("req.ip:", req.ip);
     console.log("x-forwarded-for:", req.headers["x-forwarded-for"]);
     console.log("x-real-ip:", req.headers["x-real-ip"]);
     console.log("cf-connecting-ip:", req.headers["cf-connecting-ip"]);
     console.log("socket remoteAddress:", req.socket?.remoteAddress);
     console.log("All headers:", req.headers);

     req.clientInfo = {
          ipAddress: req.get("cf-connecting-ip") || req.ip,
          device: data.device,
          browser: data.browser,
          os: data.os,
     };

     next();
};
