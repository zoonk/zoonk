import "server-only";
import { type AppRoute } from "@/i18n/navigation";
import { UpgradeCTA } from "./upgrade-cta";

/**
 * Presents the shared Plus message from the access result already resolved by
 * core. This component owns presentation only and never repeats authorization.
 */
export function SubscriptionGate<Href extends string>({
  backHref,
  backLabel,
  children,
  hasAccess,
}: {
  backHref: AppRoute<Href>;
  backLabel: string;
  children: React.ReactNode;
  hasAccess: boolean;
}) {
  if (hasAccess) {
    return children;
  }

  return <UpgradeCTA backHref={backHref} backLabel={backLabel} />;
}
