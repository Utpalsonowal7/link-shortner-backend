-- AlterTable
ALTER TABLE "links" ADD COLUMN     "domainId" INTEGER;

-- CreateTable
CREATE TABLE "domains" (
    "id" SERIAL NOT NULL,
    "domain" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domains_domain_key" ON "domains"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "domains_verificationToken_key" ON "domains"("verificationToken");

-- CreateIndex
CREATE INDEX "domains_userId_idx" ON "domains"("userId");

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
