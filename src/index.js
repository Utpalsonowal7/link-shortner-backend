import "dotenv/config"

import app from "./app.js";
import { connectDB, disconnectDB } from "./lib/db.js";
import "./lib/worker.js";

const port = process.env.PORT || 8080

let server;

connectDB()
     .then(() => {
          server = app.listen(port, () => {
               console.log(`✅ Application is running at port ${port}`);
          });
      })
     .catch((err) => {
          console.log(`Connection Error : ${err}`);
          process.exit(1);
     })

process.on("unhandledRejection", async (err) => {
     console.error(`Unhandle Rejection : ${err}`);
     server.close(async () => {
          await disconnectDB();
          process.exit(1);
     })
});

process.on("uncaughtException", async (er) => {
     console.error(`Uncaught Exception : ${er}`);
     server.close(async () => {
          await disconnectDB();
          process.exit(1);
     })
});

process.on("SIGTERM", () => {
     console.log(`Sigterm recived, Shutting down application gracefully`);
     server.close(async () => {
          await disconnectDB();
          process.exit(0);
     })
})

