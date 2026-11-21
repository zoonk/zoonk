-- AlterTable
ALTER TABLE "mock_exam_answers" ADD COLUMN     "edit_order" INTEGER,
ADD COLUMN     "edit_writer" UUID,
ADD COLUMN     "revision" UUID;
