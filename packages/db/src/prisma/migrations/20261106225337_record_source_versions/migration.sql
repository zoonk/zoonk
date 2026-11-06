-- AlterTable
ALTER TABLE "items" ADD COLUMN     "source_hash" TEXT;

-- CreateTable
CREATE TABLE "library_step_sources" (
    "step_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "content_hash" TEXT,

    CONSTRAINT "library_step_sources_pkey" PRIMARY KEY ("step_id","source_id")
);

-- CreateIndex
CREATE INDEX "library_step_sources_source_id_idx" ON "library_step_sources"("source_id");

-- AddForeignKey
ALTER TABLE "library_step_sources" ADD CONSTRAINT "library_step_sources_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "library_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_step_sources" ADD CONSTRAINT "library_step_sources_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
