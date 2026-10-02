import { PlusBenefits } from "@/components/pricing/plus-benefits";
import { type Subscription } from "@zoonk/db";
import { Badge } from "@zoonk/ui/components/badge";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
} from "@zoonk/ui/components/container";
import { isWebManagedSubscriptionProvider } from "@zoonk/utils/subscription";
import { getExtracted, getFormatter } from "next-intl/server";
import { SettingsPage, SettingsPageTitle } from "../_components/settings-page";
import { CancelPlusButton } from "./cancel-plus-button";
import { ManagedSubscription } from "./managed-subscription";

const INCLUDED_ID = "plus-included";

/**
 * When the subscription ends or renews. Stripe renews at the period's end unless it was canceled;
 * the stores renew on their own terms, so for them it's only when the paid period ends.
 */
async function getDateLine(subscription: Subscription): Promise<string | null> {
  const t = await getExtracted();
  const format = await getFormatter();

  const toDate = (date: Date) =>
    format.dateTime(new Date(date), { day: "numeric", month: "long", year: "numeric" });

  if (subscription.cancelAt) {
    return t("Your subscription will end on {date}.", { date: toDate(subscription.cancelAt) });
  }

  if (!subscription.periodEnd) {
    return null;
  }

  return isWebManagedSubscriptionProvider(subscription.provider)
    ? t("Renews on {date}.", { date: toDate(subscription.periodEnd) })
    : t("Current billing period ends on {date}.", { date: toDate(subscription.periodEnd) });
}

/**
 * A subscriber's plan instead of the offer: that Plus is active or ending, when it renews or ends,
 * what it includes, and where to manage it, which depends on where it was bought.
 */
export async function CurrentPlan({ subscription }: { subscription: Subscription }) {
  const [t, dateLine] = await Promise.all([getExtracted(), getDateLine(subscription)]);
  const isEnding = Boolean(subscription.cancelAt);

  return (
    <SettingsPage>
      <ContainerHeader>
        <ContainerHeaderGroup>
          <div className="flex flex-wrap items-center gap-2">
            <SettingsPageTitle>{t("Plus")}</SettingsPageTitle>
            <Badge variant={isEnding ? "secondary" : "success"}>
              {isEnding ? t("Subscription ending") : t("Active")}
            </Badge>
          </div>

          {dateLine && <ContainerDescription>{dateLine}</ContainerDescription>}
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="gap-8">
        <section aria-labelledby={INCLUDED_ID} className="flex flex-col gap-3">
          <h2 className="text-base font-semibold" id={INCLUDED_ID}>
            {t("What's included")}
          </h2>
          <PlusBenefits />
        </section>

        {isWebManagedSubscriptionProvider(subscription.provider) ? (
          !isEnding && <CancelPlusButton />
        ) : (
          <ManagedSubscription provider={subscription.provider} />
        )}
      </ContainerBody>
    </SettingsPage>
  );
}
