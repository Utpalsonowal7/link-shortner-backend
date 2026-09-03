import { getClientInfo } from "../utils/parseDevice.js";

export const clientDetails = (req, res, next) => {
     const userAgent = req.get("user-agent") || "";
     const data = getClientInfo(userAgent);

   console.log({
        cf: req.headers["cf-connecting-ip"],
        xff: req.headers["x-forwarded-for"],
        real: req.headers["x-real-ip"],
        remote: req.socket?.remoteAddress,
        protocol: req.protocol,
   });

     req.clientInfo = {
          ipAddress: req.get("cf-connecting-ip") || req.ip,
          device: data.device,
          browser: data.browser,
          os: data.os,
     };

     next();
};
