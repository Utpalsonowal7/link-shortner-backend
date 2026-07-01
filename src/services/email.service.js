import { BrevoClient } from "@getbrevo/brevo";
import Mailgen from "mailgen";

const client = new BrevoClient({
     apiKey: process.env.BRAVO_API_KEY,
});

const mailGeneator = new Mailgen({
     theme: "default",
     product: {
          name: "Sonowal Auth",
          logo: "https://res.cloudinary.com/utpalcloud/image/upload/v1771939862/w90jg2d4d9pxach4uanc.png",
          link: "https://yourapp.com"
     }
});

export const sendEmail = async (options) => {
     const htmlContent = mailGeneator.generate(options.mailgenContent);
     const textContent = mailGeneator.generatePlaintext(options.mailgenContent);

     const recipientName = options.name?.trim() || "User";

     try {
          const info = await client.transactionalEmails.sendTransacEmail({
               subject: options.subject,
               htmlContent,
               textContent,
               sender: { name: "Utpal Sonowal", email: "utpal@utpal.utpx.in" },
               to: [{ email: options.email, name: recipientName }]
          });

          return info;
     } catch (err) {
          console.error(`BREVO API error ${err.statusCode}:`, err.message);
          throw err;
     }
};