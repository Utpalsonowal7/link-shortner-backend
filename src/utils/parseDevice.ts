import { UAParser as ua } from "ua-parser-js";

export const getClientInfo = (userAgent = "") => {
     const parse = new ua(userAgent);
     const data = parse.getResult();

     return {
          device: data.device.type || "desktop",
          browser: data.browser.name || null,
          os: data.os.name || null,
          model: data.device.model || null,
     };
};
