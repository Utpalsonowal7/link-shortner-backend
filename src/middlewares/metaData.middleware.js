import { getClientInfo } from "../utils/parseDevice.js";
import getClientIp from "../utils/getClientIP.js";

export const clientDetails = (req, res, next) => {
     const userAgent = req.get("user-agent") || "";
     const data = getClientInfo(userAgent);
     const ip = getClientIp(req);

     req.clientInfo = {
          ipAddress: ip,
          device: data.device,
          browser: data.browser,
          os: data.os,
     };

     next();
};
