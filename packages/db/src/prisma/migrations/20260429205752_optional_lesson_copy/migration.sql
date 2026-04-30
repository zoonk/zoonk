-- AlterTable
ALTER TABLE "lessons" ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "normalized_title" DROP NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;
