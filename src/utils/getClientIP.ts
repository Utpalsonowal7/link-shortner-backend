import type { Request } from "express";

function getClientIp(req: Request) {
     const cfIp = req.get("cf-connecting-ip");

     const forwarded = req.get("x-forwarded-for");
     const forwardedIp = forwarded?.split(",")[0].trim();

     const realIp = req.get("x-real-ip");

     const socketIp = req.socket.remoteAddress;

     const clientIp = cfIp || forwardedIp || realIp || socketIp;

     return clientIp;
}

export default getClientIp;
