import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type SubscriptionProvider } from "@zoonk/utils/subscription";
import { APPLE_SUBSCRIPTIONS_URL, GOOGLE_PLAY_SUBSCRIPTIONS_URL } from "@zoonk/utils/url";
import { getExtracted } from "next-intl/server";

/** Web plan controls can't change a store or Zoonk-managed subscription. */
export async function ManagedSubscription({
  provider,
}: {
  provider: Exclude<SubscriptionProvider, "stripe">;
}) {
  const t = await getExtracted();
  const action = getManagedSubscriptionAction({ provider });

  const actionLabel = getManagedSubscriptionActionLabel({
    appleLabel: t("Manage in App Store"),
    googleLabel: t("Manage in Google Play"),
    provider,
  });

  const description = getManagedSubscriptionDescription({
    appleDescription: t("You subscribed in the App Store."),
    googleDescription: t("You subscribed in Google Play."),
    provider,
    zoonkDescription: t("Zoonk added Plus to your account. To change it, write to us."),
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm text-pretty">{description}</p>

      <div className="flex flex-wrap gap-2">
        {action ? (
          <a
            className={cn(buttonVariants({ size: "sm" }), "w-max")}
            href={action.href}
            rel="noopener noreferrer"
            target="_blank"
          >
            {actionLabel}
          </a>
        ) : (
          <Link
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-max")}
            href="/support"
          >
            {t("Write to us")}
          </Link>
        )}
      </div>
    </div>
  );
}

function getManagedSubscriptionAction({
  provider,
}: {
  provider: Exclude<SubscriptionProvider, "stripe">;
}) {
  if (provider === "apple") {
    return { href: APPLE_SUBSCRIPTIONS_URL };
  }

  if (provider === "google") {
    return { href: GOOGLE_PLAY_SUBSCRIPTIONS_URL };
  }

  return null;
}

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
