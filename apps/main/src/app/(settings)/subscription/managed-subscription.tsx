import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type SubscriptionProvider, isStoreSubscriptionProvider } from "@zoonk/utils/subscription";
import { getExtracted } from "next-intl/server";
import Link from "next/link";

const APPLE_SUBSCRIPTION_MANAGEMENT_URL = "https://support.apple.com/billing";
const GOOGLE_SUBSCRIPTION_MANAGEMENT_URL = "https://play.google.com/store/account/subscriptions";

type ManagedSubscriptionProps = {
  cancelMessage: string | null;
  periodMessage: string | null;
  planTitle: string;
  provider: Exclude<SubscriptionProvider, "stripe">;
};

export async function ManagedSubscription({
  cancelMessage,
  periodMessage,
  planTitle,
  provider,
}: ManagedSubscriptionProps) {
  const t = await getExtracted();
  const action = getManagedSubscriptionAction({ provider });
  const supportVariant = isStoreSubscriptionProvider(provider) ? "outline" : "secondary";

  const actionLabel = getManagedSubscriptionActionLabel({
    appleLabel: t("Manage in App Store"),
    googleLabel: t("Manage in Google Play"),
    provider,
  });

  const description = getManagedSubscriptionDescription({
    appleDescription: t(
      "This subscription is managed through the App Store. To change or cancel it, use Apple's subscription settings.",
    ),
    googleDescription: t(
      "This subscription is managed through Google Play. To change or cancel it, use Google Play.",
    ),
    provider,
    zoonkDescription: t(
      "This subscription is managed by Zoonk. Contact support if you need help changing or canceling it.",
    ),
  });

  return (
    <div className="flex w-full max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{planTitle}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      {periodMessage && <p className="text-muted-foreground text-sm">{periodMessage}</p>}
      {cancelMessage && <p className="text-destructive text-sm">{cancelMessage}</p>}

      <div className="flex flex-wrap gap-3">
        {action && (
          <a
            className={cn(buttonVariants({ variant: "secondary" }), "w-max")}
            href={action.href}
            rel="noopener noreferrer"
            target="_blank"
          >
            {actionLabel}
          </a>
        )}

        <Link className={cn(buttonVariants({ variant: supportVariant }), "w-max")} href="/support">
          {t("Contact support")}
        </Link>
      </div>
    </div>
  );
}

/**
 * Store-backed subscriptions need a real handoff target, while Zoonk-managed
 * subscriptions should stay inside the product and go straight to support.
 */
function getManagedSubscriptionAction({
  provider,
}: {
  provider: Exclude<SubscriptionProvider, "stripe">;
}) {
  if (provider === "apple") {
    return {
      href: APPLE_SUBSCRIPTION_MANAGEMENT_URL,
    };
  }

  if (provider === "google") {
    return {
      href: GOOGLE_SUBSCRIPTION_MANAGEMENT_URL,
    };
  }

  return null;
}

/**
 * Only store-managed subscriptions need an external manage label. Zoonk-managed
 * subscriptions skip that action and send the user straight to support.
 */
function getManagedSubscriptionActionLabel({
  appleLabel,
  googleLabel,
  provider,
}: {
  appleLabel: string;
  googleLabel: string;
  provider: Exclude<SubscriptionProvider, "stripe">;
}) {
  if (provider === "apple") {
    return appleLabel;
  }

  if (provider === "google") {
    return googleLabel;
  }

  return null;
}

/**
 * The billing page needs provider-specific copy so users immediately understand
 * why web plan controls are hidden and what they should do next.
 */
function getManagedSubscriptionDescription({
  appleDescription,
  googleDescription,
  provider,
  zoonkDescription,
}: {
  appleDescription: string;
  googleDescription: string;
  provider: Exclude<SubscriptionProvider, "stripe">;
  zoonkDescription: string;
}) {
  if (provider === "apple") {
    return appleDescription;
  }

  if (provider === "google") {
    return googleDescription;
  }

  return zoonkDescription;
}
