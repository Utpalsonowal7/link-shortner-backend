function getClientIp(req) {
     const cfIp = req.headers["cf-connecting-ip"];

     const forwarded = req.headers["x-forwarded-for"];
     const forwardedIp = forwarded?.split(",")[0].trim();

     const realIp = req.headers["x-real-ip"];

     const socketIp = req.socket.remoteAddress;

     const clientIp = cfIp || forwardedIp || realIp || socketIp;

     return clientIp;
}

export default getClientIp;
