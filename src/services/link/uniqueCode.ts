import { customAlphabet } from "nanoid";
import { prisma } from "../../lib/db.js";

const nanoid = customAlphabet(
     "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ",
     5,
);

export const generateUniqueShortCode = async () => {
     while (true) {
          const code = nanoid();
          const existing = await prisma.link.findUnique({ where: { shortCode: code } });
          if (!existing) return code;
     }
};
