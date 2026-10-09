import { UAParser } from "ua-parser-js";
import { Bots } from "ua-parser-js/extensions";
import { isBot as isBotUserAgent } from "ua-parser-js/bot-detection";

const normalizeOrigin = (value) => {
     if (!value || value === "null") return null;

     try {
          return new URL(value).origin;
     } catch {
          return null;
     }
};

export const detectRequestTraffic = ({
     userAgent = "",
     method = "GET",
     secPurpose = "",
     purpose = "",
     originHeader = "",
     referer = "",
} = {}) => {
     const parser = new UAParser(Bots);
     const browser = parser.setUA(userAgent).getBrowser();
     const userAgentIsBot = isBotUserAgent(userAgent);
     const fetchPurpose = `${secPurpose} ${purpose}`;

     let botReason = null;
     let botName = null;

     if (userAgentIsBot) {
          botReason = "user_agent";
          botName = browser.name || "Detected bot";
     } else if (/\\b(prefetch|prerender)\\b/i.test(fetchPurpose)) {
          botReason = "prefetch";
          botName = "Browser prefetch";
     } else if (method.toUpperCase() === "HEAD") {
          botReason = "head_request";
          botName = "HTTP HEAD check";
     }

     return {
          isBot: botReason !== null,
          botName,
          botReason,
          origin: normalizeOrigin(originHeader) || normalizeOrigin(referer),
     };
};
