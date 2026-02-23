import "server-only";
import { hasActiveSubscription } from "@zoonk/core/auth/subscription";
import { headers } from "next/headers";
import { UpgradeCTA } from "./upgrade-cta";

export async function SubscriptionGate({
  bypass,
  children,
}: {
  bypass?: boolean;
  children: React.ReactNode;
}) {
  if (bypass) {
    return children;
  }

  const hasSubscription = await hasActiveSubscription(await headers());

  if (!hasSubscription) {
    return <UpgradeCTA />;
  }

  return children;
}
