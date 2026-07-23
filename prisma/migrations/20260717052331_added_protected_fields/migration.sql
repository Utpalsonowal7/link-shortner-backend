-- AlterTable
ALTER TABLE "links" ADD COLUMN     "is_password_protected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password" TEXT;
