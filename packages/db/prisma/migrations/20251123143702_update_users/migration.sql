-- AlterTable
ALTER TABLE "subscription" ALTER COLUMN "status" SET DEFAULT 'incomplete';

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "banned" DROP NOT NULL,
ALTER COLUMN "role" DROP NOT NULL,
ALTER COLUMN "role" DROP DEFAULT;

-- AlterTable
ALTER TABLE "verification" ALTER COLUMN "updatedAt" DROP DEFAULT;
