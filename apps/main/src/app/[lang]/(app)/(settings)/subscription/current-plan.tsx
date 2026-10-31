import { PlusBenefits } from "@/components/pricing/plus-benefits";
import { Link } from "@/i18n/navigation";
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
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { isWebManagedSubscriptionProvider } from "@zoonk/utils/subscription";
import { getExtracted, getFormatter } from "next-intl/server";
import { Suspense } from "react";
import { KeepPlusButton } from "./keep-plus-button";
import { ManagedSubscription } from "./managed-subscription";
import { RefundOffer } from "./refund-offer";

function renderDate(chunks: React.ReactNode) {
  return <span className="tabular-nums">{chunks}</span>;
}

/** The stores renew on their own terms, so for them it's only when the paid period ends. */
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

/** An ending Plus can be kept while only its renewal stopped, and refunded while the 14 days last. */
async function EndingPlanActions() {
  const { data: cancellation } = await safeAsync(() => getWebPlusCancellation());

  if (cancellation?.status !== "ready") {
    return null;
  }

  const { canResumeRenewal, timeZone, withdrawal } = cancellation;

  return (
    <div className="flex flex-col gap-6 empty:hidden">
      {canResumeRenewal && <KeepPlusButton />}
      {withdrawal && <RefundOffer timeZone={timeZone} until={withdrawal.until} />}
    </div>
  );
}

async function WebPlanAction({ isEnding }: { isEnding: boolean }) {
  const t = await getExtracted();

  if (isEnding) {
    return (
      <Suspense>
        <EndingPlanActions />
      </Suspense>
    );
  }

  return (
    <Link
      className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-max")}
      href="/subscription/cancel"
    >
      {t("Cancel subscription")}
    </Link>
  );
}

export async function CurrentPlan({ subscription }: { subscription: Subscription }) {
  const t = await getExtracted();
  const dateLine = await getDateLine(subscription);
  const isEnding = Boolean(subscription.cancelAt);

  return (
    <Page>
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
