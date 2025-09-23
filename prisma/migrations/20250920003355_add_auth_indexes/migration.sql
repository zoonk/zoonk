-- CreateIndex
CREATE INDEX "account_userId_idx" ON "public"."account"("userId");

-- CreateIndex
CREATE INDEX "session_userId_token_idx" ON "public"."session"("userId", "token");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "public"."user"("email");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "public"."verification"("identifier");
