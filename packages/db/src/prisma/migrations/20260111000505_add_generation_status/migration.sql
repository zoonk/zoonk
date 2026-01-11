-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "generation_status" VARCHAR(20) NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "generation_status" VARCHAR(20) NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "generation_status" VARCHAR(20) NOT NULL DEFAULT 'completed',
ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "generation_status" VARCHAR(20) NOT NULL DEFAULT 'pending';
