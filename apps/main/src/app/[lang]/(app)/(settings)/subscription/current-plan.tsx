import { SectionPageHeader } from "@/components/learn/section-page";
import { PlusBenefits } from "@/components/pricing/plus-benefits";
import { getMomentDateFormatter } from "@/lib/dates";
import { type getWebPlusSubscription } from "@zoonk/core/subscriptions/get-web-plus-subscription";
import { type Subscription } from "@zoonk/db";
import { CHIP_CLASS } from "@zoonk/learn/chip";
import {
  Page,
  PageSection,
  PageSectionHeader,
  PageSectionTitle,
  PageSubtitle,
} from "@zoonk/learn/page";
import { isWebManagedSubscriptionProvider } from "@zoonk/utils/subscription";
import { getExtracted } from "next-intl/server";
import { CancelPlusButton } from "./cancel-plus-button";
import { KeepPlusButton } from "./keep-plus-button";
import { ManagedSubscription } from "./managed-subscription";
import { renderPlanDate } from "./plan-date";

async function getStoreDateLine(subscription: Subscription): Promise<React.ReactNode> {
  const t = await getExtracted();
  const formatDate = await getMomentDateFormatter();
  const toDate = (date: Date) => formatDate(new Date(date), { year: "always" });

  const endingAt =
    subscription.cancelAt ?? (subscription.cancelAtPeriodEnd ? subscription.periodEnd : null);

  if (endingAt) {
    return t.rich("Plus ends on <mono>{date}</mono>.", {
      date: toDate(endingAt),
      mono: renderPlanDate,
    });
  }

  if (!subscription.periodEnd) {
    return null;
  }

  const date = toDate(subscription.periodEnd);

  // Nobody pays for a Plus that Zoonk added, so it has an end, not a renewal.
  return subscription.provider === "apple" || subscription.provider === "google"
    ? t.rich("Renews on <mono>{date}</mono>.", { date, mono: renderPlanDate })
    : t.rich("You have Plus until <mono>{date}</mono>.", { date, mono: renderPlanDate });
}

type WebSubscription = Extract<
  NonNullable<Awaited<ReturnType<typeof getWebPlusSubscription>>>,
  { status: "ready" }
>;

type WebSubscriptionResult = Awaited<ReturnType<typeof getWebPlusSubscription>>;

async function WebPlanAction({ periodEnd, state }: Pick<WebSubscription, "periodEnd" | "state">) {
  if (state === "ending") {
    return <KeepPlusButton />;
  }

  const formatDate = await getMomentDateFormatter();
  const paidUntil = periodEnd ? formatDate(periodEnd, { year: "always" }) : undefined;

  return <CancelPlusButton endsNow={state === "unpaid"} paidUntil={paidUntil} />;
}

async function getWebDateLine(web: WebSubscription) {
  const t = await getExtracted();

  if (web.state === "unpaid") {
    return t("Your last renewal payment failed.");
  }

  if (!web.periodEnd) {
    return null;
  }

  const formatDate = await getMomentDateFormatter();
  const date = formatDate(web.periodEnd, { year: "always" });

  return web.state === "ending"
    ? t.rich("Plus ends on <mono>{date}</mono>.", { date, mono: renderPlanDate })
    : t.rich("Renews on <mono>{date}</mono>.", { date, mono: renderPlanDate });
}

async function WebsiteSubscription({ web }: { web: WebSubscription }) {
  const t = await getExtracted();

  const dateLine = await getWebDateLine(web);

  const title = t({
    description:
      "On the subscription page, labels Plus bought on the Zoonk website, where it's managed.",
    message: "Through the website",
  });

  return (
    <PageSection aria-label={title}>
      <PageSectionHeader>
        <PageSectionTitle>{title}</PageSectionTitle>
      </PageSectionHeader>
      {dateLine && <p className="text-muted-foreground text-sm">{dateLine}</p>}
      <WebPlanAction periodEnd={web.periodEnd} state={web.state} />
    </PageSection>
  );
}

export async function CurrentPlan({
  subscription,
  webSubscription,
}: {
  subscription: Subscription;
  webSubscription: WebSubscriptionResult;
}) {
  const t = await getExtracted();
  const web = webSubscription?.status === "ready" ? webSubscription : null;
  const isWebsite = isWebManagedSubscriptionProvider(subscription.provider);

  const dateLine = isWebsite
    ? web && (await getWebDateLine(web))
    : await getStoreDateLine(subscription);

  const isEnding = isWebsite
    ? web?.state === "ending"
    : Boolean(subscription.cancelAt || subscription.cancelAtPeriodEnd);

  return (
    <Page measure="form">
      <SectionPageHeader title={t("Subscription")} />

      <PageSection>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <PageSectionTitle>{t("Plus")}</PageSectionTitle>
            {/* A status, not a result: quiet, as the Plus mark is, never blue. */}
            <span className={CHIP_CLASS}>{isEnding ? t("Ending") : t("Active")}</span>
          </div>

          {/* One phrase: the subtitle lays its children out as separate facts. */}
          {dateLine && (
            <PageSubtitle>
              <span>{dateLine}</span>
            </PageSubtitle>
          )}
        </div>
      </PageSection>

      <PageSection aria-label={t("What's included")}>
        <PlusBenefits />
      </PageSection>

      <div className="empty:hidden">
        {isWebManagedSubscriptionProvider(subscription.provider) ? (
          web && <WebPlanAction periodEnd={web.periodEnd} state={web.state} />
        ) : (
          <div className="flex flex-col gap-6">
            <ManagedSubscription provider={subscription.provider} />
            {web && <WebsiteSubscription web={web} />}
          </div>
        )}
      </div>
    </Page>
  );
}
