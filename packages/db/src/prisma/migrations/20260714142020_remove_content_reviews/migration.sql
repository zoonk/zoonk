/*
  Warnings:

  - You are about to drop the `content_reviews` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "content_reviews" DROP CONSTRAINT "content_reviews_user_id_fkey";

-- DropTable
DROP TABLE "content_reviews";
