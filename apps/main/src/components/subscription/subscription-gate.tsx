import "server-only";
import { type AppRoute } from "@/i18n/navigation";
import { hasActiveSubscription } from "@zoonk/core/auth/subscription";
import { headers } from "next/headers";
import { UpgradeCTA } from "./upgrade-cta";

/**
 * Keeps generation pages on one subscription check and one upgrade message, so
 * chapter and lesson generation explain the free limit consistently.
 */
export async function SubscriptionGate<Href extends string>({
  backHref,
  backLabel,
  bypass,
  children,
}: {
  backHref: AppRoute<Href>;
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
