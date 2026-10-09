import { getClientInfo } from "../utils/parseDevice.js";
import getClientIp from "../utils/getClientIP.js";
import { detectRequestTraffic } from "../utils/detectBot.js";

export const clientDetails = (req, res, next) => {
     const userAgent = req.get("user-agent") || "";
     const data = getClientInfo(userAgent);
     const ip = getClientIp(req);
     const traffic = detectRequestTraffic({
          userAgent,
          method: req.method,
          secPurpose: req.get("sec-purpose") || "",
          purpose: req.get("purpose") || "",
          originHeader: req.get("origin") || "",
          referer: req.get("referer") || "",
     });

     req.clientInfo = {
          ipAddress: ip,
          device: data.device,
          browser: data.browser,
          os: data.os,
          userAgent,
          ...traffic,
     };

     next();
};
