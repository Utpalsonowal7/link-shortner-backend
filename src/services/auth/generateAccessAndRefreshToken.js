import { prisma } from "../../lib/db.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwt.js";
import { hashToken } from "../../utils/hashToken.js";

export const generateAccessAndRefreshToken = async (data, clientInfo) => {
     console.log(clientInfo.device);
     const accessToken = generateAccessToken({
          id: data?.id,
          name: data?.name ?? null,
          email: data?.email
     });

     const refreshToken = generateRefreshToken({
          id: data?.id
     });

     const hashRefreshToken = hashToken(refreshToken);

     await prisma.session.create({
          data: {
               userId: data.id,
               refreshToken: hashRefreshToken,
               expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
               ipAddress: clientInfo?.ipAddress,
               userAgent: clientInfo?.device
          }
     });

     return { accessToken, refreshToken }
};
