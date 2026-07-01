import { customAlphabet } from "nanoid";
import { prisma } from "../../lib/db.js";

const nanoid = customAlphabet(
     "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ",
     5,
);

export const generateUniqueShortCode = async () => {
     let code;
     let exists = true;

     while (exists) {
          code = nanoid();
          exists = await prisma.link.findUnique({
               where: {
                    shortCode: code,
               },
          });
     }

     return code;
};
