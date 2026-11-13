import {
  EYEBROW_CLASS,
  PUBLIC_BAND_CLASS,
  PUBLIC_CONTAINER_CLASS,
} from "@/components/public/landing-styles";
import { PageStartMark } from "@/components/public/page-start";
import { getStartControlClassName } from "@/components/public/public-start";
import { Link } from "@/i18n/navigation";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { SURFACE_CLASS } from "@zoonk/learn/surface";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { type PriceInfo } from "@zoonk/utils/currency";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { ForViewer } from "./for-viewer";
import { FreePlan } from "./free-plan";
import { PLAN_CARD_CLASS } from "./plan-includes";
import { type BillingPeriod, PlusLoginLink, PlusPlan, type PlusViewerState } from "./plus-plan";
import { PlusQuestions } from "./plus-questions";

export async function getPlusPricingMetadata(): Promise<Pick<Metadata, "description" | "title">> {
  const t = await getExtracted();

  return {
    description: t(
      "Zoonk is free for {lessons, plural, one {# lesson} other {# lessons}} a month. Zoonk Plus has no monthly limit and adds mock exams and an AI study buddy whenever you're stuck. Pay monthly or yearly, cancel anytime.",
      { lessons: getFreePlanLimits().lessonsPerMonth ?? 0 },
    ),
    // Absolute: the name is already in it.
    title: { absolute: t("Zoonk pricing: free and Plus plans") },
  };
}

export async function PricingHero() {
  const t = await getExtracted();

  return (
    <section
      aria-labelledby="pricing-title"
      className={cn(PUBLIC_CONTAINER_CLASS, "flex flex-col pt-12 lg:pt-24")}
    >
      <p className={EYEBROW_CLASS}>{t("Pricing")}</p>

      <h1 className="text-headline mt-4 max-w-[16em]" id="pricing-title">
        {t({
          description:
            "The pricing page's headline. “Your date” is the day the reader is studying for: an exam, a move, a new job.",
          message: "Follow your plan all the way to your date.",
        })}
      </h1>

      <p className="text-lead mt-4 max-w-152">
        {t({
          description: "“Plus” is the name of the subscription.",
          message:
            "Plus has no monthly limit on lessons, so you study as much as each day's plan asks for.",
        })}
      </p>
    </section>
  );
}

const PRICING_BILLING_SWITCH = "pricing-billing";

const PRICING_CLOSE_ID = "pricing-close";

/** Side by side once each card fits its name and the billing switch on one row (`@3xl` in `plan-includes`). */
const PLAN_CARDS_CLASS = "grid gap-4 @3xl:grid-cols-2";

export function PricingPlans({
  monthlyPrice,
  yearlyPrice,
}: {
  monthlyPrice: PriceInfo | null;
  yearlyPrice: PriceInfo | null;
}) {
  const currency = (monthlyPrice ?? yearlyPrice)?.currency ?? null;

  return (
    <div className={cn(PUBLIC_CONTAINER_CLASS, "@container pt-12 pb-14 sm:pb-20 lg:pb-24")}>
      <div className={cn(PLAN_CARDS_CLASS, "lg:gap-5")}>
        <FreePlan currency={currency} />

        <PlusPlan
          billingSwitch={PRICING_BILLING_SWITCH}
          monthlyPrice={monthlyPrice}
          yearlyPrice={yearlyPrice}
        />
      </div>
    </div>
  );
}

const PLUS_PRICING_CLASS = "@container flex max-w-5xl flex-col gap-7";

function PlanCardSkeleton() {
  return (
    <div className={cn(SURFACE_CLASS, PLAN_CARD_CLASS, "gap-4")}>
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-11 w-full rounded-lg" />
      <div className="flex flex-col gap-3 border-t pt-5">
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function PricingQuestions() {
  return (
    <div className={cn(PUBLIC_CONTAINER_CLASS, "pt-14 sm:pt-20 lg:pt-24")}>
      <PlusQuestions
        className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-baseline lg:gap-12"
        titleClassName="text-section"
      />
    </div>
  );
}

async function VisitorPricingClose({ hasChoice }: { hasChoice: boolean }) {
  const t = await getExtracted();

  return (
    <section
      aria-labelledby={PRICING_CLOSE_ID}
      className={cn(
        PUBLIC_CONTAINER_CLASS,
        PUBLIC_BAND_CLASS,
        "flex flex-col items-center text-center",
      )}
    >
      <h2 className="text-headline max-w-[14em]" id={PRICING_CLOSE_ID}>
        {t("Start free, no account needed.")}
      </h2>

      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <PageStartMark />
        <Link className={getStartControlClassName()} href="/start">
          {t("Build my plan")}
        </Link>
        <PlusLoginLink
          billingSwitch={PRICING_BILLING_SWITCH}
          className={cn(buttonVariants({ size: "lg", variant: "outline" }), "px-5")}
          hasChoice={hasChoice}
        />
      </div>
    </section>
  );
}

export function PricingClose({ hasChoice }: { hasChoice: boolean }) {
  return (
    <ForViewer
      render={({ status }) => status === "visitor" && <VisitorPricingClose hasChoice={hasChoice} />}
    />
  );
}

export function PlusPricing({
  defaultPeriod,
  monthlyPrice,
  usedToday,
  viewerState,
  yearlyPrice,
}: {
  defaultPeriod?: BillingPeriod;
  monthlyPrice: PriceInfo | null;
  usedToday?: ReactNode;
  viewerState: PlusViewerState;
  yearlyPrice: PriceInfo | null;
}) {
  const currency = (monthlyPrice ?? yearlyPrice)?.currency ?? null;

  return (
    <div className={PLUS_PRICING_CLASS}>
      <div className={PLAN_CARDS_CLASS}>
        <PlusPlan
          billingSwitch="subscription-billing"
          defaultPeriod={defaultPeriod}
          monthlyPrice={monthlyPrice}
          viewerState={viewerState}
          yearlyPrice={yearlyPrice}
        />

        <FreePlan currency={currency} usedToday={usedToday} viewerState={viewerState} />
      </div>

      <PlusQuestions
        className="@3xl:grid @3xl:grid-cols-2 @3xl:items-baseline @3xl:gap-4"
        viewerState={viewerState}
      />
    </div>
  );
}

export function PlusPricingSkeleton() {
  return (
    <div aria-hidden="true" className={PLUS_PRICING_CLASS}>
      <div className={PLAN_CARDS_CLASS}>
        <PlanCardSkeleton />
        <PlanCardSkeleton />
      </div>
    </div>
  );
}
