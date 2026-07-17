INSERT INTO "user_roles" ("user_id", "role_id")
SELECT "users"."id", "roles"."id"
FROM "users"
CROSS JOIN "roles"
WHERE "roles"."key" = 'USER'
ON CONFLICT ("user_id", "role_id") DO NOTHING;
