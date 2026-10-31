-- AddForeignKey
ALTER TABLE "live_call_connections" ADD CONSTRAINT "live_call_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "access_records" ("id", "user_id", "ip_address", "created_at")
SELECT "id", "user_id", "ip_address", "created_at" FROM "sessions"
WHERE "created_at" >= CURRENT_TIMESTAMP AT TIME ZONE 'UTC' - INTERVAL '6 months'
ON CONFLICT ("id") DO NOTHING;
