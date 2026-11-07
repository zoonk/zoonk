/*
  Warnings:

  - A unique constraint covering the columns `[domain]` on the table `organizations` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "is_pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "product_id" UUID,
ADD COLUMN     "product_release_id" UUID,
ADD COLUMN     "uncomparable_notes_hash" TEXT,
ADD COLUMN     "uncomparable_release_id" UUID;

-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "product_checked_at" TIMESTAMP(3),
ADD COLUMN     "product_id" UUID,
ADD COLUMN     "product_release_id" UUID;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "description" TEXT,
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "website" TEXT NOT NULL,
    "website_source_id" UUID,
    "docs_source_id" UUID,
    "description" TEXT NOT NULL,
    "image_url" TEXT,
    "releases_source_id" UUID,
    "releases_hash" TEXT,
    "unreadable_releases_hash" TEXT,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_releases" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "product_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "version" TEXT,
    "released_at" DATE,
    "support_ends_at" DATE,
    "source_id" UUID,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_normalized_name_idx" ON "products"("normalized_name");

-- CreateIndex
CREATE INDEX "products_aliases_idx" ON "products" USING GIN ("aliases");

-- CreateIndex
CREATE INDEX "products_docs_source_id_idx" ON "products"("docs_source_id");

-- CreateIndex
CREATE INDEX "products_releases_source_id_idx" ON "products"("releases_source_id");

-- CreateIndex
CREATE INDEX "products_website_source_id_idx" ON "products"("website_source_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_normalized_name_key" ON "products"("organization_id", "normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_slug_key" ON "products"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "product_releases_source_id_idx" ON "product_releases"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_releases_product_id_normalized_name_key" ON "product_releases"("product_id", "normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "product_releases_product_id_slug_key" ON "product_releases"("product_id", "slug");

-- CreateIndex
CREATE INDEX "courses_product_id_language_idx" ON "courses"("product_id", "language");

-- CreateIndex
CREATE INDEX "courses_product_release_id_idx" ON "courses"("product_release_id");

-- CreateIndex
CREATE INDEX "goals_product_id_idx" ON "goals"("product_id");

-- CreateIndex
CREATE INDEX "goals_product_release_id_idx" ON "goals"("product_release_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_domain_key" ON "organizations"("domain");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_product_release_id_fkey" FOREIGN KEY ("product_release_id") REFERENCES "product_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_product_release_id_fkey" FOREIGN KEY ("product_release_id") REFERENCES "product_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_website_source_id_fkey" FOREIGN KEY ("website_source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_docs_source_id_fkey" FOREIGN KEY ("docs_source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_releases_source_id_fkey" FOREIGN KEY ("releases_source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_releases" ADD CONSTRAINT "product_releases_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_releases" ADD CONSTRAINT "product_releases_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
