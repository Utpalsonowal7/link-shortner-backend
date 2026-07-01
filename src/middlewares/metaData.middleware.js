import { getClientInfo } from "../utils/parseDevice.js";

export const clientDetails = (req, res, next) => {
     console.log("user ip and user agent", req.ip);
     const userAgent = req.get("user-agent") || "";
     const data = getClientInfo(userAgent);
     console.log(data);
     req.clientInfo = {
          ipAddress: req.ip,
          device: data.device,
          browser: data.browser,
          os: data.os,
     };

     next();
};
