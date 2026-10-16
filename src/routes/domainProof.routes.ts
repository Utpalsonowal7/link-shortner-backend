import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { prisma } from "../lib/db.js";
import { asyncHandler } from "../utils/async_handler.js";
import { normalizeDomain } from "../utils/domain.js";
import { routingProof } from "../services/domain/proxy.js";

const router = Router();
// Public proof is available for registered but not-yet-verified domains;
// otherwise verification would be circular. It grants no tenant access.
router.get("/", rateLimit({ windowMs: 60_000, limit: 120, keyGenerator: req => ipKeyGenerator(req.socket.remoteAddress ?? "127.0.0.1") }), asyncHandler(async (req, res) => {
    res.set("Cache-Control", "no-store, max-age=0");
    const rawHost = req.headers.host;
    const nonce = req.query.nonce;
    if (!rawHost || /[\s/@?#\\]/.test(rawHost) || typeof nonce !== "string" || !/^[a-f0-9]{48}$/.test(nonce)) {
        return res.sendStatus(400);
    }
    let hostname: string;
    try { hostname = normalizeDomain(new URL(`http://${rawHost}`).hostname); }
    catch { return res.sendStatus(400); }
    const domain = await prisma.domain.findUnique({ where: { domain: hostname }, select: { id: true } });
    if (!domain) return res.sendStatus(404);
    return res.type("text/plain").send(routingProof(hostname, nonce));
}));
export default router;
