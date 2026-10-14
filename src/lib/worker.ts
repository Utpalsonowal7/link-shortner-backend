import { Worker } from "bullmq";
import { sendEmail } from "../services/email.service.js";
import { redisConnection } from "./redis.js";
import type { EmailJobData } from "../types/index.js";

export const emailWorker = new Worker<EmailJobData, unknown, string>(
     "email-queue",
     async (job) => {
          const { subject, name, email, mailgenContent } = job.data;

          await sendEmail(
               {
                    subject,
                    mailgenContent,
                    email,
                    name
               }
          )
          console.log(`✅ Email sent to ${email}`);
     },
     { connection: redisConnection }
);

emailWorker.on("completed", (job) => console.log(`JOB ${job.id} completed`));
emailWorker.on("failed", (job, err) => console.error(`JOB ${job?.id ?? "unknown"} failed : ${err}`));
