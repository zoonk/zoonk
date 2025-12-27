-- CreateTable
CREATE TABLE "course_categories" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_categories_category_idx" ON "course_categories"("category");

-- CreateIndex
CREATE UNIQUE INDEX "course_categories_course_id_category_key" ON "course_categories"("course_id", "category");

-- AddForeignKey
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
