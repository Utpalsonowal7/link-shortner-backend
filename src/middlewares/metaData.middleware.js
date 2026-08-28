import { getClientInfo } from "../utils/parseDevice.js";

export const clientDetails = (req, res, next) => {
     console.log({
          ip: req.ip,
          ips: req.ips,
          forwarded: req.get("x-forwarded-for"),
          realIp: req.get("x-real-ip"),
          cfIp: req.get("cf-connecting-ip"),
     });

     const userAgent = req.get("user-agent") || "";
     const data = getClientInfo(userAgent);

     req.clientInfo = {
          ipAddress: req.ip,
          device: data.device,
          browser: data.browser,
          os: data.os,
     };

     next();
};