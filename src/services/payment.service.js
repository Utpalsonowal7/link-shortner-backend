import Razorpay from "razorpay";
import crypto from "node:crypto";
import { prisma } from "../lib/db.js";
import { ApiError } from "../utils/api_error.js";

const razorpay = new Razorpay({
     key_id: process.env.RAZORPAY_KEY_ID,
     key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createDonationOrder = async (data) => {
     const { name, email, phone, amount } = data;

     const amountInPaise = Math.round(Number(amount) * 100);

     if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
          throw new ApiError(400, "Invalid donation amount");
     }

     const order = await razorpay.orders.create({
          amount: amountInPaise,
          currency: "INR",
          receipt: `donation_${Date.now()}`,
     });

     if (!order) {
          throw new ApiError(400, "Failed to create Razorpay order");
     }

     const donation = await prisma.donation.create({
          data: {
               name,
               email,
               phone,
               amount: amountInPaise,
               currency: "INR",
               razorpayOrderId: order.id,
               status: "PENDING",
          },
     });

     return {
          donationId: donation.id,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
     };
};

const verifyDonationPayment = async ({
     donationId,
     razorpayOrderId,
     razorpayPaymentId,
     razorpaySignature,
}) => {
     const donation = await prisma.donation.findUnique({
          where: {
               id: Number(donationId),
          },
     });

     if (!donation) {
          throw new ApiError(404, "Donation not found");
     }

     if (donation.razorpayOrderId !== razorpayOrderId) {
          throw new ApiError(400, "Invalid Razorpay order");
     }

     const generatedSignature = crypto
          .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest("hex");

     if (generatedSignature !== razorpaySignature) {
          throw new ApiError(400, "Invalid payment signature");
     }

     const updatedDonation = await prisma.donation.update({
          where: {
               id: donation.id,
          },
          data: {
               status: "SUCCESS",
          },
     });

     return updatedDonation;
};

export { createDonationOrder, verifyDonationPayment };
