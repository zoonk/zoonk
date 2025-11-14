-- CreateTable
CREATE TABLE "page" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "image" TEXT,
    "x_url" TEXT,
    "instagram_url" TEXT,
    "linkedin_url" TEXT,
    "threads_url" TEXT,
    "youtube_url" TEXT,
    "tiktok_url" TEXT,
    "github_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_member" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "page_slug_key" ON "page"("slug");

-- CreateIndex
CREATE INDEX "page_slug_idx" ON "page"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "page_member_page_id_user_id_key" ON "page_member"("page_id", "user_id");

-- CreateIndex
CREATE INDEX "page_member_user_id_idx" ON "page_member"("user_id");

-- CreateIndex
CREATE INDEX "page_member_page_id_role_idx" ON "page_member"("page_id", "role");

-- AddForeignKey
ALTER TABLE "page_member" ADD CONSTRAINT "page_member_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_member" ADD CONSTRAINT "page_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
