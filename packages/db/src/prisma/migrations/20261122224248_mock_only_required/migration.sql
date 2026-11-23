-- Questions and sets still without a value were never held for a mock exam: 20261120135300_mock_reserve gave every
-- earlier row false, and core read a null as false.
UPDATE "item_sets" SET "mock_only" = false WHERE "mock_only" IS NULL;

UPDATE "items" SET "mock_only" = false WHERE "mock_only" IS NULL;

-- AlterTable
ALTER TABLE "item_sets" ALTER COLUMN "mock_only" SET NOT NULL;

-- AlterTable
ALTER TABLE "items" ALTER COLUMN "mock_only" SET NOT NULL;
