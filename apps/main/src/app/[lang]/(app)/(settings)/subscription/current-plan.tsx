import { PlusBenefits } from "@/components/pricing/plus-benefits";
import { type Subscription } from "@zoonk/db";
import { CHIP_CLASS } from "@zoonk/learn/chip";
import {
  Page,
  PageHeader,
  PageHeaderContent,
  PageSection,
  PageSubtitle,
  PageTitle,
} from "@zoonk/learn/page";
import { isWebManagedSubscriptionProvider } from "@zoonk/utils/subscription";
import { getExtracted, getFormatter } from "next-intl/server";
import { CancelPlusButton } from "./cancel-plus-button";
import { ManagedSubscription } from "./managed-subscription";

/** The date in a sentence, in the sentence's face as every number in a sentence reads. */
function renderDate(chunks: React.ReactNode) {
  return <span className="tabular-nums">{chunks}</span>;
}

/**
 * When the subscription ends or renews. Stripe renews at the period's end unless it was canceled;
 * the stores renew on their own terms, so for them it's only when the paid period ends.
 */
async function getDateLine(subscription: Subscription): Promise<React.ReactNode> {
  const t = await getExtracted();
  const format = await getFormatter();

  const toDate = (date: Date) =>
    format.dateTime(new Date(date), { day: "numeric", month: "short", year: "numeric" });

  if (subscription.cancelAt) {
    return t.rich("Your subscription will end on <mono>{date}</mono>.", {
      date: toDate(subscription.cancelAt),
      mono: renderDate,
    });
  }

  if (!subscription.periodEnd) {
    return null;
  }

  return isWebManagedSubscriptionProvider(subscription.provider)
    ? t.rich("Renews on <mono>{date}</mono>.", {
        date: toDate(subscription.periodEnd),
        mono: renderDate,
      })
    : t.rich("Current billing period ends on <mono>{date}</mono>.", {
        date: toDate(subscription.periodEnd),
        mono: renderDate,
      });
}

/**
 * A subscriber's plan instead of the offer: that Plus is active or ending, when it renews or ends,
 * what it includes, and where to manage it, which depends on where it was bought.
 */
export async function CurrentPlan({ subscription }: { subscription: Subscription }) {
  const t = await getExtracted();
  const dateLine = await getDateLine(subscription);
  const isEnding = Boolean(subscription.cancelAt);

  return (
    <Page>
      <PageHeader>
        <PageHeaderContent>
          <div className="flex flex-wrap items-center gap-2">
            {/* Under the section's title from a tablet up, the plan's name is a step smaller. */}
            <PageTitle className="md:text-xl md:leading-tight">{t("Plus")}</PageTitle>
            {/* A status, not a result: quiet, as the Plus mark is, never blue. */}
            <span className={CHIP_CLASS}>{isEnding ? t("Subscription ending") : t("Active")}</span>
          </div>

          {/* One phrase: the subtitle lays its children out as separate facts. */}
          {dateLine && (
            <PageSubtitle>
              <span>{dateLine}</span>
            </PageSubtitle>
          )}
        </PageHeaderContent>
      </PageHeader>

      {/* The benefits' own line leads ("Every goal · every lesson"): a smaller title over it read
          as the lesser of the two. */}
      <PageSection aria-label={t("What's included")}>
        <PlusBenefits />
      </PageSection>

      <div className="empty:hidden">
        {isWebManagedSubscriptionProvider(subscription.provider) ? (
          !isEnding && <CancelPlusButton />
        ) : (
          <ManagedSubscription provider={subscription.provider} />
        )}
      </div>
    </Page>
  );
}
