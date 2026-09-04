function getClientIp(req) {
     const cfIp = req.headers["cf-connecting-ip"];

     const forwarded = req.headers["x-forwarded-for"];
     const forwardedIp = forwarded?.split(",")[0].trim();

     const realIp = req.headers["x-real-ip"];

     const socketIp = req.socket.remoteAddress;

     const clientIp = cfIp || forwardedIp || realIp || socketIp;

     console.log("========== IP DEBUG ==========");
     console.log("CF-Connecting-IP :", cfIp);
     console.log("X-Forwarded-For  :", forwarded);
     console.log("X-Real-IP        :", realIp);
     console.log("Socket Address   :", socketIp);
     console.log("req.ip           :", req.ip);
     console.log("req.ips          :", req.ips);
     console.log("FINAL CLIENT IP  :", clientIp);
     console.log("==============================");

     return clientIp;
}

export default getClientIp;
