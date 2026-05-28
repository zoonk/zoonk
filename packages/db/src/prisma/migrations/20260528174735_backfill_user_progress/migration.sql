INSERT INTO "user_progress" ("user_id", "current_energy", "total_brain_power", "last_active_at")
SELECT "users"."id", 0, 0, "users"."created_at"
FROM "users"
WHERE NOT EXISTS (
  SELECT 1
  FROM "user_progress"
  WHERE "user_progress"."user_id" = "users"."id"
);
