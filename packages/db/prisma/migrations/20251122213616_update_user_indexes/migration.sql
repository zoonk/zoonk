-- DropIndex
DROP INDEX "session_userId_token_idx";

-- DropIndex
DROP INDEX "user_email_idx";

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");
