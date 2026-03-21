import "server-only";
import { hasActiveSubscription } from "@zoonk/core/auth/subscription";
import { type Route } from "next";
import { headers } from "next/headers";
import { UpgradeCTA } from "./upgrade-cta";

export async function SubscriptionGate<Href extends string>({
  backHref,
  backLabel,
  bypass,
  children,
}: {
  backHref: Route<Href>;
  backLabel: string;
  bypass?: boolean;
  children: React.ReactNode;
}) {
  if (bypass) {
    return children;
  }

  const hasSubscription = await hasActiveSubscription(await headers());

  if (!hasSubscription) {
    return <UpgradeCTA backHref={backHref} backLabel={backLabel} />;
  }

  return children;
}
