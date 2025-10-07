import type { Subscription } from "@better-auth/stripe";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

async function getActiveSubscription() {
  const { data: subscription } = await authClient.subscription.list();

  const activeSubscription = subscription?.find(
    (sub) => sub.status === "active" || sub.status === "trialing",
  );

  return activeSubscription || null;
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    getActiveSubscription()
      .then(setSubscription)
      .catch(() => setSubscription(null));
  }, []);

  return { subscription };
}
