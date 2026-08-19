-- AlterTable
ALTER TABLE "links" ADD COLUMN     "qrUrl" TEXT;

-- CreateIndex
CREATE INDEX "links_qrUrl_idx" ON "links"("qrUrl");
