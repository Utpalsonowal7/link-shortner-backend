import { ApiError } from "../../utils/api_error.js";
import { prisma } from "../../lib/db.js";

export const existingUser = async (email) => {
     const user = await prisma.user.findUnique({
          where: {
               email: email
          },
          select: {
               email: true
          }
     });

     if (user) {
          throw new ApiError(
               409,
               `User with ${user.email} already exists`
          )
     };
}