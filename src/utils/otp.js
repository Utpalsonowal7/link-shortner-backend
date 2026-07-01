import crypto from "crypto";

export const generateTokens = () => {
     const otp = crypto.randomInt(1000, 9999);

     const hashOtp = crypto.createHash('sha256').update(otp.toString()).digest('hex');

     return {otp, hashOtp}
}