import { prisma } from "../../lib/db.js";
import crypto from "crypto";
import { ApiError } from "../../utils/api_error.js";

const generateVerificationToken = () => {
     return `utpx_verify_${crypto.randomBytes(24).toString("hex")}`;
};

const createDomain = async (userId, domain) => {
     const cleanDomain = domain
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/\/+$/, "");

     if (!cleanDomain) {
          throw new ApiError(400, "Domain is required");
     }

     const existingDomain = await prisma.domain.findUnique({
          where: {
               domain: cleanDomain,
          },
     });

     if (existingDomain) {
          throw new ApiError(409, "Domain already exists");
     }

     const verificationToken = generateVerificationToken();

     const newDomain = await prisma.domain.create({
          data: {
               domain: cleanDomain,
               userId,
               verificationToken,
          },
     });

     return {
          id: newDomain.id,
          domain: newDomain.domain,
          isVerified: newDomain.isVerified,

          dns: {
               verification: {
                    type: "TXT",
                    name: "_utpx",
                    value: verificationToken,
               },

               routing: {
                    type: "CNAME",
                    name: "@",
                    value: process.env.CUSTOM_DOMAIN_TARGET,
               },
          },

          createdAt: newDomain.createdAt,
     };
};

const getUserDomains = async (userId) => {
     return await prisma.domain.findMany({
          where: {
               userId,
          },
          orderBy: {
               createdAt: "desc",
          },
          select: {
               id: true,
               domain: true,
               isVerified: true,
               verifiedAt: true,
               createdAt: true,
               updatedAt: true,
          },
     });
};

const getDomainById = async (userId, domainId) => {
     const domain = await prisma.domain.findFirst({
          where: {
               id: domainId,
               userId,
          },
          select: {
               id: true,
               domain: true,
               isVerified: true,
               verifiedAt: true,
               createdAt: true,
               updatedAt: true,
          },
     });

     if (!domain) {
          throw new ApiError(404, "Domain not found");
     }

     return domain;
};

const deleteDomain = async (userId, domainId) => {
     const domain = await prisma.domain.findFirst({
          where: {
               id: domainId,
               userId,
          },
     });

     if (!domain) {
          throw new ApiError(404, "Domain not found");
     }

     await prisma.domain.delete({
          where: {
               id: domainId,
          },
     });

     return {
          message: "Domain deleted successfully",
     };
};

export default {
     CreateDomainService: createDomain,
     GetDomainUser: getUserDomains,
     GetDomainByIf: getDomainById,
     DeleteDomain: deleteDomain,
};
