import { PrismaClient } from "../../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if(!connectionString) {
     console.log(`❌ Database connection error : DATABASE_URL is not defined in .env file`);
     process.exit(1);
}

const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({
     log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["warn"],
     adapter
});

const connectDB = async () => {
     try {
          await prisma.$connect();
          await prisma.$queryRaw`SELECT 1`;
          console.log(`✅ Database connected successfully`);
     } catch (error) {
          console.log(`❌ Database connection error : ${error}`);
          process.exit(1);
     }
};

const disconnectDB = async () => {
     await prisma.$disconnect()
};

export { prisma, connectDB, disconnectDB }