import "dotenv/config";
import type { Server } from "node:http";
import app from "./app.js";
import { connectDB, disconnectDB } from "./lib/db.js";
import { emailWorker } from "./lib/worker.js";
import { emailQueue } from "./lib/queqe.js";
import { client } from "./lib/redis.js";

const port = Number(process.env.PORT || 8080);
let server: Server | undefined;
let stopping = false;

async function shutdown(exitCode: number) {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(exitCode || 1), 10_000);
    timeout.unref();
    try {
        const httpServer = server;
        if (httpServer) await new Promise<void>((resolve, reject) => httpServer.close(err => err ? reject(err) : resolve()));
        await emailWorker.close();
        await emailQueue.close();
        client.disconnect();
        await disconnectDB();
    } catch (error) {
        console.error("Shutdown failed", error);
        exitCode = 1;
    } finally {
        clearTimeout(timeout);
        process.exit(exitCode);
    }
}

connectDB().then(() => {
    server = app.listen(port, () => console.log(`✅ Application is running at port ${port}`));
    server.on("error", error => { console.error("HTTP server error", error); void shutdown(1); });
}).catch(error => { console.error("Connection error", error); void shutdown(1); });

process.on("unhandledRejection", error => { console.error("Unhandled rejection", error); void shutdown(1); });
process.on("uncaughtException", error => { console.error("Uncaught exception", error); void shutdown(1); });
process.on("SIGTERM", () => { void shutdown(0); });
process.on("SIGINT", () => { void shutdown(0); });
