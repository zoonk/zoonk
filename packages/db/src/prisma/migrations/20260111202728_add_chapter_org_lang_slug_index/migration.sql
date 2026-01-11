-- CreateIndex
CREATE INDEX "chapters_organization_id_language_slug_idx" ON "chapters"("organization_id", "language", "slug");
