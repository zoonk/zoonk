-- Google Play subscriptions are always tied to the Zoonk user the purchase names, and the purchase
-- token is their chain identity: without it the provider-scoped unique index can't tell rows apart.
-- No Google rows exist before this integration.
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_google_user_id_check" CHECK ("provider" <> 'google' OR "user_id" IS NOT NULL);

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_google_provider_subscription_id_check" CHECK ("provider" <> 'google' OR "provider_subscription_id" IS NOT NULL);
