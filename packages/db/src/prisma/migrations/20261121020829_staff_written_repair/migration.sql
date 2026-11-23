-- AlterTable
ALTER TABLE "exam_blueprints" ADD COLUMN     "notice_reread_source" TEXT;

UPDATE "oauth_clients"
SET "scopes" = array_append("scopes", 'staff:repair-writing')
WHERE "client_id" = 'zoonk-cli' AND NOT ('staff:repair-writing' = ANY("scopes"));
