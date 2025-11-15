import type { Subscription } from "@better-auth/stripe";
import { useEffect, useState } from "react";
import { authClient } from "../client";

async function getActiveSubscription() {
  const { data: subscription } = await authClient.subscription.list();

  const activeSubscription = subscription?.find(
    (sub) => sub.status === "active" || sub.status === "trialing",
  );

  return activeSubscription || null;
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<
    Subscription | null | undefined
  >();

  const isPending = subscription === undefined;

  useEffect(() => {
    getActiveSubscription()
      .then(setSubscription)
      .catch(() => setSubscription(null));
  }, []);

  return { isPending, subscription };
}
