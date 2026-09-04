import { getClientInfo } from "../utils/parseDevice.js";

export const clientDetails = (req, res, next) => {
     const userAgent = req.get("user-agent") || "";
     const data = getClientInfo(userAgent);

     console.log(req.headers);

     req.clientInfo = {
          ipAddress: req.get("cf-connecting-ip") || req.ip,
          device: data.device,
          browser: data.browser,
          os: data.os,
     };

     next();
};
