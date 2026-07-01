import { z } from "zod";

const registerSchema = z.object({
    email: z.string().email("Invalid email address").toLowerCase().trim(),

    password: z
        .string()
        .min(8, "Password must be at least 8 characters long")
        .max(100, "Password is too long")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(
            /[^a-zA-Z0-9]/,
            "Password must contain at least one special character",
        ),
});

const otpSchema = z.object({
    email: z.string().email("Invalid email address").toLowerCase().trim(),
    otp: z.coerce
        .number()
        .int()
        .min(1000, "OTP must be a 4-digit number")
        .max(9999, "OTP must be a 4-digit number"),
});

const forgotPasswordSchema = z.object({
    email: z.string().email("Invalid email").toLowerCase().trim(),
});

const resetPasswordSchema = z.object({
    email: z.string().email("Invalid email").toLowerCase().trim(),
    otp: z.coerce.number().int().min(1000).max(9999),
    password: z.string().min(8, "Password must be at least 8 characters"),
});

const changePasswordSchema = z.object({
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export {
    registerSchema,
    otpSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
};
