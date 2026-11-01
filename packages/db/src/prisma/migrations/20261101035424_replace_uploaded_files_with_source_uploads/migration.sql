/*
  Warnings:

  - You are about to drop the `uploaded_files` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "uploaded_files" DROP CONSTRAINT "uploaded_files_source_id_fkey";

-- DropForeignKey
ALTER TABLE "uploaded_files" DROP CONSTRAINT "uploaded_files_user_id_fkey";

-- DropTable
DROP TABLE "uploaded_files";

-- CreateTable
CREATE TABLE "source_uploads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "source_uploads_source_id_idx" ON "source_uploads"("source_id");

-- CreateIndex
CREATE INDEX "source_uploads_user_id_idx" ON "source_uploads"("user_id");

-- AddForeignKey
ALTER TABLE "source_uploads" ADD CONSTRAINT "source_uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_uploads" ADD CONSTRAINT "source_uploads_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
