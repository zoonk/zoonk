-- AlterTable
ALTER TABLE "api_keys" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "jwks" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
