-- CreateTable
CREATE TABLE "course_users" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_users_course_id_idx" ON "course_users"("course_id");

-- CreateIndex
CREATE INDEX "course_users_user_id_idx" ON "course_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_users_course_id_user_id_key" ON "course_users"("course_id", "user_id");

-- AddForeignKey
ALTER TABLE "course_users" ADD CONSTRAINT "course_users_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_users" ADD CONSTRAINT "course_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
