-- originalTransactionId is the durable identity for an Apple renewal chain. Without it, the
-- provider-scoped unique index cannot distinguish NULL values and the row cannot be reconciled.
-- NOT VALID avoids deleting any historical malformed rows while enforcing the invariant for
-- every new or updated row; production had no Apple subscriptions before this integration.
ALTER TABLE "subscriptions"
ADD CONSTRAINT "subscriptions_apple_provider_subscription_id_check"
CHECK ("provider" <> 'apple' OR "provider_subscription_id" IS NOT NULL) NOT VALID;
