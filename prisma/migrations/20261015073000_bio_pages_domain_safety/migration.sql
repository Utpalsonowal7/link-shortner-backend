-- Keep domain deletion from silently deleting short links and their analytics.
ALTER TABLE "links" DROP CONSTRAINT "links_domainId_fkey";
ALTER TABLE "links" ADD CONSTRAINT "links_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "bio_pages" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "avatarUrl" TEXT,
  "theme" TEXT NOT NULL DEFAULT 'light',
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "domainId" INTEGER REFERENCES "domains"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "bio_pages_slug_key" ON "bio_pages"("slug");
CREATE UNIQUE INDEX "bio_pages_domainId_key" ON "bio_pages"("domainId");
CREATE INDEX "bio_pages_userId_idx" ON "bio_pages"("userId");
CREATE TABLE "bio_links" (
  "id" SERIAL PRIMARY KEY,
  "pageId" INTEGER NOT NULL REFERENCES "bio_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX "bio_links_pageId_position_idx" ON "bio_links"("pageId", "position");
