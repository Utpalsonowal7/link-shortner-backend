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

     const domainName = newDomain.domain.split(".")[0] || newDomain.domain;

     return {
          id: newDomain.id,
          domain: newDomain.domain,
          isVerified: newDomain.isVerified,

          dns: {
               routing: {
                    type: "CNAME",
                    name: domainName,
                    value: process.env.CUSTOM_DOMAIN_TARGET,
               },
          },

          createdAt: newDomain.createdAt,
     };
};

const getUserDomains = async (userId) => {
     const res = await prisma.domain.findMany({
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
     // console.log(res[0].domain)
     // const domainName = res.domain.split(".")[0] || res.domain;

     const domainFormat = res.map((d) => ({
          id: d.id,
          domain: d.domain,
          isVerified: d.isVerified,

          dns: {
               routing: {
                    type: "CNAME",
                    name: d.domain.split(".")[0] || d.domain,
                    value: process.env.CUSTOM_DOMAIN_TARGET,
               },
          },

          createdAt: d.createdAt,
     }));

     
     return { domainFormat };
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
