import type { RegisterInput, OtpInput, LoginInput, ResetPasswordInput, ChangePasswordInput } from "../validators/authSchema.js";
import { requireUser, queryString } from "../utils/request.js";
import { ApiResponse } from "../utils/api_response.js";
import { ApiError } from "../utils/api_error.js";
import { asyncHandler } from "../utils/async_handler.js";
import { AuthServices } from "../services/index.js";
import {
    accessTokenOptions,
    refreshTokenOptions,
} from "../utils/cookieOptions.js";

const registerUser = asyncHandler<RegisterInput>(async (req, res) => {
    const { name = "", email, password } = req.body;

    const newUser = await AuthServices.RegisterService({
        name,
        email,
        password,
    });

    if (!newUser) {
        throw new ApiError(
            400,
            "Something Went wrong while registering the user",
        );
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, { newUser }, "✅ User created successfully!"),
        );
});

const verifyOtp = asyncHandler<OtpInput>(async (req, res) => {
    const { email, otp } = req.body;

    await AuthServices.VerifyOtpService({ email, otp });

    return res
        .status(200)
        .json(new ApiResponse(200, null, "✅ OTP verified successfully!"));
});

const resendOtp = asyncHandler<{ email: string }>(async (req, res) => {
    const { email } = req.body;

    await AuthServices.ResendOtpService({ email });

    return res
        .status(200)
        .json(new ApiResponse(200, null, "✅ OTP resent successfully!"));
});

const loginUser = asyncHandler<LoginInput>(async (req, res) => {
    const { email, password } = req.body;
    const clientInfo = req.clientInfo;

    const data = await AuthServices.LoginService(
        { email: email, password: password },
        clientInfo,
    );

    return res
        .status(200)
        .cookie("accessToken", data.accessToken, data.accessTokenOptions)
        .cookie("refreshToken", data.refreshToken, data.refreshTokenOptions)
        .json(
            new ApiResponse(
                200,
                {
                    user: {
                        id: data.user?.id,
                        name: data.user?.name,
                        email: data.user?.email,
                    },
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                },
                "User logged In successfully",
            ),
        );
});

const refreshAccessToken = asyncHandler<{ refreshToken?: unknown }>(async (req, res) => {
    const incomingRefreshToken =
        req.cookies?.refreshToken || req.body?.refreshToken;

    const data =
        await AuthServices.RefreshAccessTokenService(incomingRefreshToken);

    return res
        .status(200)
        .cookie("accessToken", data.accessToken, data.accessTokenOptions)
        .cookie("refreshToken", data.refreshToken, data.refreshTokenOptions)
        .json(
            new ApiResponse(
                200,
                {
                    user: {
                        id: data.user?.id,
                        name: data.user?.name,
                        email: data.user?.email,
                    },
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                },
                "Access token refreshed successfully",
            ),
        );
});

const googleAuth = asyncHandler(async (req, res) => {
    const url = AuthServices.GoogleAuthUrlService();

    res.redirect(url);
});

const googleAuthCallback = asyncHandler(async (req, res) => {
    const code = queryString(req.query.code);

    if (!code) {
        throw new ApiError(400, "Authorization code missing");
    }

    const {
        user,
        accessToken,
        refreshToken,
        accessTokenOptions,
        refreshTokenOptions,
    } = await AuthServices.GoogleAuthService(code, req.clientInfo);

    return res
        .status(200)
        .cookie("accessToken", accessToken, accessTokenOptions)
        .cookie("refreshToken", refreshToken, refreshTokenOptions)
        .redirect(`${process.env.FRONTEND_URL}/home`);
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { user: requireUser(req) },
                "User fetched successfully",
            ),
        );
});

const logOut = asyncHandler(async (req, res) => {
    await AuthServices.LogOutService(requireUser(req).id);

    return res
        .status(200)
        .clearCookie("accessToken", accessTokenOptions)
        .clearCookie("refreshToken", refreshTokenOptions)
        .json(new ApiResponse(200, null, "Logged out successfully"));
});

const forgotPassword = asyncHandler<{ email: string }>(async (req, res) => {
    const { email } = req.body;

    await AuthServices.ForgetPaswordService(email);

    return res
        .status(200)
        .json(new ApiResponse(200, "Reset password Otp send to email"));
});

const resetPassword = asyncHandler<ResetPasswordInput>(async (req, res) => {
    const { email, otp, password } = req.body;

    await AuthServices.ResetPasswordService({ email, otp, password });

    return res
        .status(200)
        .json(new ApiResponse(200, "Password Reset Successfully"));
});

const chnagePassword = asyncHandler<ChangePasswordInput>(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    await AuthServices.ChangePasswordService(
        { oldPassword, newPassword },
        requireUser(req).id,
    );

    return res
        .status(200)
        .json(new ApiResponse(200, "Password Change Successfully"));
});

export {
    registerUser,
    verifyOtp,
    resendOtp,
    loginUser,
    refreshAccessToken,
    googleAuth,
    googleAuthCallback,
    getCurrentUser,
    logOut,
    forgotPassword,
    resetPassword,
    chnagePassword
};
