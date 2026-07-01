import { Worker } from "bullmq";
import { sendEmail } from "../services/email.service.js";
import {client} from "./redis.js";

export const emailWorker = new Worker(
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
     { connection: client }
);

emailWorker.on("completed", (job) => console.log(`JOB ${job.id} completed`));
emailWorker.on("failed", (job, err) => console.error(`JOB ${job.id} failed : ${err}`));