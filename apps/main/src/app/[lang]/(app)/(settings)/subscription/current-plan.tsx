import { PlusBenefits } from "@/components/pricing/plus-benefits";
import { getWebPlusCancellation } from "@zoonk/core/subscriptions/web-plus-cancellation";
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
import { safeAsync } from "@zoonk/utils/error";
import { isWebManagedSubscriptionProvider } from "@zoonk/utils/subscription";
import { getExtracted, getFormatter } from "next-intl/server";
import { Suspense } from "react";
import { CancelPlusButton } from "./cancel-plus-button";
import { KeepPlusButton } from "./keep-plus-button";
import { ManagedSubscription } from "./managed-subscription";

function renderDate(chunks: React.ReactNode) {
  return <span className="tabular-nums">{chunks}</span>;
}

async function getDateLine(subscription: Subscription): Promise<React.ReactNode> {
  const t = await getExtracted();
  const format = await getFormatter();

  const toDate = (date: Date) =>
    format.dateTime(new Date(date), { day: "numeric", month: "short", year: "numeric" });

  const endingAt =
    subscription.cancelAt ?? (subscription.cancelAtPeriodEnd ? subscription.periodEnd : null);

  if (endingAt) {
    return t.rich("Your subscription will end on <mono>{date}</mono>.", {
      date: toDate(endingAt),
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

async function EndingPlanActions() {
  const { data: cancellation } = await safeAsync(() => getWebPlusCancellation());

  return cancellation?.status === "ready" && cancellation.canResumeRenewal ? (
    <KeepPlusButton />
  ) : null;
}

function WebPlanAction({ isEnding }: { isEnding: boolean }) {
  return isEnding ? (
    <Suspense>
      <EndingPlanActions />
    </Suspense>
  ) : (
    <CancelPlusButton />
  );
}

export async function CurrentPlan({ subscription }: { subscription: Subscription }) {
  const t = await getExtracted();
  const dateLine = await getDateLine(subscription);
  const isEnding = Boolean(subscription.cancelAt || subscription.cancelAtPeriodEnd);

  return (
    <Page className="max-w-form">
      <PageHeader>
        <PageHeaderContent>
          <div className="flex flex-wrap items-center gap-2">
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

      <PageSection aria-label={t("What's included")}>
        <PlusBenefits />
      </PageSection>

      <div className="empty:hidden">
        {isWebManagedSubscriptionProvider(subscription.provider) ? (
          <WebPlanAction isEnding={isEnding} />
        ) : (
          <ManagedSubscription provider={subscription.provider} />
        )}
      </div>
    </Page>
  );
}
