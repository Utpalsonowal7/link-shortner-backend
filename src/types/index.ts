import type { User } from "../../generated/prisma/client.js";
import type Mailgen from "mailgen";

export type SafeUser = Omit<User, "password">;
export type UserIdentity = Pick<User, "id" | "name" | "email">;

export interface ClientInfo {
    ipAddress?: string;
    device: string;
    browser: string | null;
    os: string | null;
    agent: string;
}

export interface ClickClientInfo {
    ip?: string;
    device?: string | null;
    browser?: string | null;
    os?: string | null;
    referrer?: string | null;
    agent?: string | null;
}

export interface EmailJobData {
    subject: string;
    name?: string | null;
    email: string;
    mailgenContent: Mailgen.Content;
}

export interface GoogleTokenResponse { access_token: string }
export interface GoogleUserResponse {
    id: string;
    name: string;
    email: string;
    verified_email: boolean;
    picture?: string;
}

export interface DonationInput {
    name: string;
    email: string;
    phone?: string;
    amount: number | string;
}

export interface DonationVerificationInput {
    donationId: number | string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: SafeUser;
            clientInfo: ClientInfo;
        }
    }
}
