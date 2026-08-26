/*
  Warnings:

  - The values [PAID] on the enum `DonationStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DonationStatus_new" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
ALTER TABLE "public"."Donation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Donation" ALTER COLUMN "status" TYPE "DonationStatus_new" USING ("status"::text::"DonationStatus_new");
ALTER TYPE "DonationStatus" RENAME TO "DonationStatus_old";
ALTER TYPE "DonationStatus_new" RENAME TO "DonationStatus";
DROP TYPE "public"."DonationStatus_old";
ALTER TABLE "Donation" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
