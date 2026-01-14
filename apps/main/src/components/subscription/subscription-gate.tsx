import "server-only";

import { auth } from "@zoonk/core/auth";
import { findActiveSubscription } from "@zoonk/core/auth/subscription";
import { headers } from "next/headers";
import { UpgradeCTA } from "./upgrade-cta";

export async function SubscriptionGate({
  children,
  returnUrl,
}: {
  children: React.ReactNode;
  returnUrl: string;
}) {
  const subscriptions = await auth.api.listActiveSubscriptions({
    headers: await headers(),
  });

  if (!findActiveSubscription(subscriptions)) {
    return <UpgradeCTA returnUrl={returnUrl} />;
  }

  return <>{children}</>;
}
