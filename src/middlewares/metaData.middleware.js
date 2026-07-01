import { getClientInfo } from "../utils/parseDevice.js";

export const clientDetails = (req, res, next) => {
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
