import "server-only";
import { hasActiveSubscription } from "@zoonk/core/auth/subscription";
import { headers } from "next/headers";
import { UpgradeCTA } from "./upgrade-cta";

export async function SubscriptionGate({
  children,
  returnUrl,
}: {
  children: React.ReactNode;
  returnUrl: string;
}) {
  const hasSubscription = await hasActiveSubscription(await headers());

  if (!hasSubscription) {
    return <UpgradeCTA returnUrl={returnUrl} />;
  }

  return children;
}
