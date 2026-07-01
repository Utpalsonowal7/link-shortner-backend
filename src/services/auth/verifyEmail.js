import {prisma} from "../../lib/db.js";
import {client} from "../../lib/redis.js";
import { ApiError } from "../../utils/api_error.js";
import { ApiResponse } from "../../utils/api_response.js";
import { otpKey } from "../../utils/otpKey.js";
import crypto from "crypto";

export const verifyOtp = async (data) => {
     const { email, otp } = data;

     const hashOtp = await client.get(otpKey(email));

     if (!hashOtp) {
          throw new ApiError(400, "OTP has expired or is invalid");
     };

     const isOtpValid = crypto.timingSafeEqual(
          Buffer.from(hashOtp),
          Buffer.from(crypto.createHash("sha256").update(otp.toString()).digest("hex"))
     );

     if (!isOtpValid) {
          throw new ApiError(400, "Invalid OTP");
     }

     await prisma.user.update({
          where: {
               email: email
          },
          data: {
               isEmailVerified: true
          }
     });

     await client.del(otpKey(email));

};