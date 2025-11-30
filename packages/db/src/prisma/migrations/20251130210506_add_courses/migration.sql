-- CreateTable
CREATE TABLE "courses" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "language" VARCHAR(10) NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "courses_organization_id_language_is_published_idx" ON "courses"("organization_id", "language", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "courses_organization_id_slug_key" ON "courses"("organization_id", "slug");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
