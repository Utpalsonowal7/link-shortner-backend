import { prisma } from "../../lib/db.js";
import { client } from "../../lib/redis.js";
import { existingUser } from "./checkExistingUser.js";
import { generateTokens } from "../../utils/otp.js";
import { emailQueue } from "../../lib/queqe.js";
import { otpKey } from "../../utils/otpKey.js";
import bcrypt from "bcrypt";
import { ApiError } from "../../utils/api_error.js";
import { verifyOtp } from "./verifyEmail.js";
import { handleExistingUser } from "./handleExistingUser.js";
import { generateAccessAndRefreshToken } from "./generateAccessAndRefreshToken.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwt.js";
import { hashToken } from "../../utils/hashToken.js";
import { getGoogleToken } from "./getGoogleToken.js";
import { googleUser } from "./getGoogleUser.js";
import {
    accessTokenOptions,
    refreshTokenOptions,
} from "../../utils/cookieOptions.js";
import {
    emailVerificationOtpContent,
    passwordResetOtpContent,
} from "../mailTemplate.js";
import crypto from "crypto";

const registerUser = async (data) => {
    const { name, email, password } = data;

    await existingUser(email);

    const hashPass = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            name: name,
            email: email,
            password: hashPass,
        },
        omit: {
            password: true,
        },
    });

    if (!user) {
        throw new ApiError(400, "Something went wrong while creating the user");
    }

    const { otp, hashOtp } = generateTokens();

    await emailQueue.add(
        "send-verification-email",
        {
            subject: "Verification otp email!",
            email: user?.email,
            name: user?.name,
            mailgenContent: emailVerificationOtpContent(user?.name, otp),
        },
        {
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 5000,
            },
        },
    );

    await client.setex(otpKey(user.email), 300, hashOtp);

    return user;
};

const verifyOtpService = async (data) => {
    await verifyOtp(data);
};

const resendOtpService = async (data) => {
    const { email } = data;

    const user = await handleExistingUser(email);

    const isOtpExists = await client.get(otpKey(user.email));

    if (isOtpExists) {
        throw new ApiError(
            400,
            "OTP already sent. Please wait for 5 minutes before requesting a new OTP",
        );
    }

    const { otp, hashOtp } = generateTokens();

    await client.setex(otpKey(user.email), 300, hashOtp);

    await emailQueue.add(
        "send-verification-email",
        {
            subject: "Verification otp email!",
            email: user?.email,
            name: user?.name,
            mailgenContent: emailVerificationOtpContent(user?.name, otp),
        },
        {
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 5000,
            },
        },
    );
};

const loginUserService = async (data, clientInfo) => {
    const { email, password } = data;

    const user = await handleExistingUser(email);

    const isPassValid = await bcrypt.compare(password, user.password);

    if (!isPassValid) {
        throw new ApiError(400, "Wrong password");
    }

    if (!user.isEmailVerified) {
        throw new ApiError(400, "Please verify you'r account first");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user,
        clientInfo,
    );

    return {
        user,
        accessToken,
        refreshToken,
        accessTokenOptions,
        refreshTokenOptions,
    };
};

const refreshAccessToken = async (incomingRefreshToken) => {
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized refresh token");
    }

    const hashRefreshToken = hashToken(incomingRefreshToken);

    const session = await prisma.session.findUnique({
        where: {
            refreshToken: hashRefreshToken,
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    if (!session) {
        throw new ApiError(401, "Invalid refresh token");
    }

    if (session.expiresAt < new Date()) {
        await prisma.session.delete({
            where: {
                id: session.id,
            },
        });

        throw new ApiError(401, "Refresh token expired");
    }

    const user = session.user;
    const accessToken = generateAccessToken({
        id: user.id,
        name: user.name ?? null,
        email: user.email,
    });
    const refreshToken = generateRefreshToken({
        id: user.id,
    });

    await prisma.session.update({
        where: {
            id: session.id,
        },
        data: {
            refreshToken: hashToken(refreshToken),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
    });

    return {
        user,
        accessToken,
        refreshToken,
        accessTokenOptions,
        refreshTokenOptions,
    };
};

const googleAuthUrlService = () => {
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        response_type: "code",
        scope: "openid profile email",
    });

    return `${process.env.GOOGLE_AUTH_URI}?${params.toString()}`;
};

const googleAuthService = async (code, clientInfo) => {
    const { access_token } = await getGoogleToken(code);

    const userData = await googleUser(access_token);

    let user = await prisma.user.findUnique({
        where: {
            email: userData?.email,
        },
    });

    if (user && user.password) {
        throw new ApiError(
            400,
            "This email is already register with email and password. please log in with your email and password",
        );
    }

    if (!user) {
        user = await prisma.user.create({
            data: {
                name: userData.name,
                email: userData.email,
                isEmailVerified: userData.verified_email,
                provider: "GOOGLE",
                providerId: userData.id,
                avatar: userData.picture,
            },
        });
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user,
        clientInfo,
    );

    return {
        user,
        accessToken,
        refreshToken,
        accessTokenOptions,
        refreshTokenOptions,
    };
};

const logOutService = async (userID) => {
    await prisma.session.deleteMany({
        where: {
            userId: userID,
        },
    });
};

const forgetPasswordService = async (data) => {
    const user = await handleExistingUser(data);

    const { otp, hashOtp } = generateTokens();
    await emailQueue.add(
        "Password_reset_mail",
        {
            subject: "Password Reset",
            email: user?.email,
            name: user?.name,
            mailgenContent: passwordResetOtpContent(user?.name, otp),
        },
        {
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 5000,
            },
        },
    );

    await client.setex(otpKey(user?.email), 3000, hashOtp);
};

const resetPasswordService = async (data) => {
    console.log(data);
    const { email, otp, password } = data;

    const storedHash = await client.get(otpKey(email));
    if (!storedHash) {
        throw new ApiError(400, "OTP expired or not found");
    }

    const isValid = crypto.timingSafeEqual(
        Buffer.from(storedHash),
        Buffer.from(
            crypto.createHash("sha256").update(otp.toString()).digest("hex"),
        ),
    );

    if (!isValid) {
        throw new ApiError(400, "Invalid OTP");
    }

    await client.del(otpKey(email));

    const hashPass = await bcrypt.hash(password, 10);
    const user = await prisma.user.update({
        where: { email },
        data: { password: hashPass },
    });

    await prisma.session.deleteMany({
        where: { userId: user.id },
    });
};

const changePasswordService = async (data, id) => {
    const { oldPassword, newPassword } = data;

    const oldDbPass = await prisma.user.findUnique({
        where: {
            id: id,
        },
    });

    const isPassCorrect = await bcrypt.compare(oldPassword, oldDbPass.password);
    if (!isPassCorrect) {
        throw new ApiError(400, "Wrong old password");
    }

    const newHashPass = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: {
            id: id,
        },
        data: {
            password: newHashPass,
        },
    });

    await prisma.session.deleteMany({
        where: {
            userId: id,
        },
    });
};

export default {
    RegisterService: registerUser,
    VerifyOtpService: verifyOtpService,
    ResendOtpService: resendOtpService,
    LoginService: loginUserService,
    RefreshAccessTokenService: refreshAccessToken,
    GoogleAuthUrlService: googleAuthUrlService,
    GoogleAuthService: googleAuthService,
    LogOutService: logOutService,
    ForgetPaswordService: forgetPasswordService,
    ResetPasswordService: resetPasswordService,
    ChangePasswordService: changePasswordService,
};
