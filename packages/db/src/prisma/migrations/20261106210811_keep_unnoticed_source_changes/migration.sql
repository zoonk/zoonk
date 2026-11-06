-- CreateTable
CREATE TABLE "unnoticed_source_changes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "source_id" UUID NOT NULL,
    "previous_hash" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unnoticed_source_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unnoticed_source_changes_source_id_key" ON "unnoticed_source_changes"("source_id");

-- AddForeignKey
ALTER TABLE "unnoticed_source_changes" ADD CONSTRAINT "unnoticed_source_changes_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
