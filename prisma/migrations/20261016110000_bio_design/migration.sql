ALTER TABLE "bio_pages" ADD COLUMN "design" JSONB NOT NULL DEFAULT '{"preset":"minimal","buttonStyle":"rounded","socials":[]}';
ALTER TABLE "bio_links" ADD COLUMN "icon" TEXT NOT NULL DEFAULT 'link';
