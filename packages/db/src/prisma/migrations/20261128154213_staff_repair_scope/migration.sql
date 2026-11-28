-- One repair scope serves every release repair, so a login asks for it once.
UPDATE "oauth_clients"
SET "scopes" = array_append(array_remove("scopes", 'staff:repair-writing'), 'staff:repair')
WHERE "client_id" = 'zoonk-cli' AND NOT ('staff:repair' = ANY("scopes"));
