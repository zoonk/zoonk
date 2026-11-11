-- DropIndex
DROP INDEX "app_attest_keys_key_id_key";

-- AlterTable
ALTER TABLE "app_attest_keys" ALTER COLUMN "key_id" DROP NOT NULL,
ALTER COLUMN "public_key" DROP NOT NULL,
ALTER COLUMN "sign_count" DROP NOT NULL,
ALTER COLUMN "created_at" DROP NOT NULL,
ALTER COLUMN "updated_at" DROP NOT NULL;
