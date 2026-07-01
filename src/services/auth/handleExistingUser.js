import { prisma } from "../../lib/db.js";
import { ApiError } from "../../utils/api_error.js";

export const handleExistingUser = async (email) => {
     const user = await prisma.user.findUnique({
          where: {
               email: email
          }
     });

     if (!user) {
          throw new ApiError(404, "User not found")
     };

     return user;
};