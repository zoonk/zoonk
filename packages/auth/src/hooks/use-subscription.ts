import { useEffect, useState } from "react";
import { authClient } from "../client";
import { findActiveSubscription } from "../subscription";
import type { Subscription } from "@better-auth/stripe";

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
