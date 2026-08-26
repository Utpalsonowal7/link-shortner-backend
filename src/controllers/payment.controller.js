import { ApiResponse } from "../utils/api_response.js";
import { asyncHandler } from "../utils/async_handler.js";
import { createDonationOrder, verifyDonationPayment } from "../services/payment.service.js";

const createOrder = asyncHandler(async (req, res) => {
     const { name, email, phone, amount } = req.body;

     const donationOrder = await createDonationOrder({
          name,
          email,
          phone,
          amount,
     });

     return res
          .status(201)
          .json(
               new ApiResponse(
                    201,
                    { donationOrder },
                    "Order created successfully",
               ),
          );
});


const verifyPayment = asyncHandler(async (req, res) => {
     const result = await verifyDonationPayment(req.body);

     return res.status(200).json(
          new ApiResponse(
               200,
               {
                    donation: result,
               },
               "Payment verified successfully",
          ),
     );
});

export { createOrder, verifyPayment };
