import { authClient } from "@zoonk/auth/client";
import { type Subscription, findActiveSubscription } from "@zoonk/auth/subscription";
import { useEffect, useState } from "react";

async function getActiveSubscription() {
  const { data: subscriptions } = await authClient.subscription.list();
  return findActiveSubscription(subscriptions) ?? null;
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null | undefined>();

  const isPending = subscription === undefined;

  useEffect(() => {
    getActiveSubscription()
      .then(setSubscription)
      .catch(() => setSubscription(null));
  }, []);

  return { isPending, subscription };
}
