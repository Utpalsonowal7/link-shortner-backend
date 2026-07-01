import { getClientInfo } from "../utils/parseDevice.js";

export const clientDetails = (req, res, next) => {
     const userAgent = req.get("user-agent") || "";
     const data = getClientInfo(userAgent);
console.log("req.ip:", req.ip);
console.log("x-forwarded-for:", req.headers["x-forwarded-for"]);
console.log("user-agent:", req.get("User-Agent"));
     req.clientInfo = {
          ipAddress: req.ip,
          device: data.device,
          browser: data.browser,
          os: data.os,
     };

     next();
};
