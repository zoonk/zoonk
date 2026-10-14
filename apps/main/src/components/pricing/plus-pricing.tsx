import {
  EYEBROW_CLASS,
  HEADLINE_CLASS,
  LEAD_CLASS,
  PUBLIC_CONTAINER_CLASS,
} from "@/components/public/landing-styles";
import { getStartControlClassName } from "@/components/public/public-start";
import { type PlusPriceTable } from "@/data/subscriptions/get-plus-price-table";
import { Link } from "@/i18n/navigation";
import { SURFACE_CLASS } from "@zoonk/learn/surface";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { BillingCurrencyScope } from "./billing-currency";
import { FreePlan } from "./free-plan";
import { PLAN_CARD_CLASS } from "./plan-includes";
import { type BillingPeriod, PlusLoginLink, PlusPlan, type PlusViewerState } from "./plus-plan";
import { PlusQuestions } from "./plus-questions";

/** The public pricing page and the subscription page describe the same offer. */
export async function getPlusPricingMetadata(): Promise<Pick<Metadata, "description" | "title">> {
  const t = await getExtracted();

  return {
    description: t(
      "Get ready for your exam, new job or move with Zoonk Plus: unlimited lessons and goals, full exam prep with mock exams and your AI study buddy. Start free.",
    ),
    title: t("Zoonk Plus: plans and pricing"),
  };
}

function renderRest(chunks: ReactNode) {
  return <span className="text-muted-foreground">{chunks}</span>;
}

/**
 * The pricing page's first words: its name as a quiet eyebrow, the offer as the headline (starting
 * free in the text color, Plus muted after it) and one line on what each covers.
 */
export async function PricingHero() {
  const t = await getExtracted();

  return (
    <section
      aria-labelledby="pricing-title"
      className={cn(PUBLIC_CONTAINER_CLASS, "flex flex-col pt-12 lg:pt-24")}
    >
      <p className={EYEBROW_CLASS}>{t("Pricing")}</p>

      <h1 className={cn(HEADLINE_CLASS, "mt-4 max-w-[16em]")} id="pricing-title">
        {t.rich("Start free. <rest>Plus when you want everything.</rest>", { rest: renderRest })}
      </h1>

      <p className={cn(LEAD_CLASS, "mt-4.5")}>
        {t("Free covers one goal at a time. Plus covers every goal, all the way to the big day.")}
      </p>
    </section>
  );
}

/** Whether the reader has no account yet: the free plan's answer then starts with trying lessons. */
function hasNoAccount(viewerState: PlusViewerState): boolean {
  return viewerState.status === "guest" || viewerState.status === "visitor";
}

/** The pricing page's billing period switch, which its closing "Get Plus" follows too. */
const PRICING_BILLING_SWITCH = "pricing-billing";

/** The two plans side by side from `md`, one under the other on phones, Free first. */
const PLANS_GRID_CLASS = "grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5";

/**
 * The plans on the public pricing page, Free and Plus, two cards of one height with each one's next
 * step for whoever is reading on the same line.
 */
export function PricingPlans({
  prices,
  viewerState,
}: {
  prices: PlusPriceTable;
  viewerState: PlusViewerState;
}) {
  return (
    <BillingCurrencyScope className={cn(PUBLIC_CONTAINER_CLASS, "pt-12")}>
      <div className={PLANS_GRID_CLASS}>
        <FreePlan prices={prices} viewerState={viewerState} />

        <PlusPlan
          billingSwitch={PRICING_BILLING_SWITCH}
          prices={prices}
          viewerState={viewerState}
        />
      </div>
    </BillingCurrencyScope>
  );
}

/** A plan card while the reader's prices load: its rows in their places. */
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

/** The plans while the reader's prices load, in their places: Free beside Plus from `md`. */
export function PricingPlansSkeleton() {
  return (
    <div aria-hidden="true" className={cn(PUBLIC_CONTAINER_CLASS, "pt-12")}>
      <div className={PLANS_GRID_CLASS}>
        <PlanCardSkeleton />
        <PlanCardSkeleton />
      </div>
    </div>
  );
}

/** The questions under the plans, their title beside them from `lg`. */
export function PricingQuestions({ viewerState }: { viewerState: PlusViewerState }) {
  return (
    <div className={cn(PUBLIC_CONTAINER_CLASS, "pt-24 lg:pt-32")}>
      <PlusQuestions
        className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12"
        hasNoAccount={hasNoAccount(viewerState)}
      />
    </div>
  );
}

/**
 * The page's last word for a visitor: starting free needs no account, with both plans' steps again,
 * starting free first. "Get Plus" keeps the billing period picked on Plus's card (`hasChoice`
 * when there's one to pick).
 */
export async function PricingClose({ hasChoice }: { hasChoice: boolean }) {
  const t = await getExtracted();

  return (
    <section
      aria-labelledby="pricing-close"
      className={cn(
        PUBLIC_CONTAINER_CLASS,
        "flex flex-col items-center pt-28 pb-24 text-center lg:pt-40 lg:pb-36",
      )}
    >
      <h2
        className="max-w-[14em] text-[32px] leading-[1.08] font-semibold tracking-[-0.04em] text-balance lg:text-5xl"
        id="pricing-close"
      >
        {t("Start free, no account needed.")}
      </h2>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link className={getStartControlClassName()} href="/start">
          {t("Start free")}
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

/**
 * The Plus offer inside the app for whoever is looking (the subscription page), then what people
 * ask before paying. A visitor also sees the free plan under it, with its free start, since
 * Plus's card keeps one action.
 */
export function PlusPricing({
  defaultPeriod,
  prices,
  viewerState,
}: {
  /** The billing period its switch opens on: the one picked on the pricing page before logging in. */
  defaultPeriod?: BillingPeriod;
  prices: PlusPriceTable;
  viewerState: PlusViewerState;
}) {
  return (
    <>
      <BillingCurrencyScope className="max-w-form flex flex-col gap-4">
        <PlusPlan
          billingSwitch="subscription-billing"
          defaultPeriod={defaultPeriod}
          prices={prices}
          viewerState={viewerState}
        />

        {viewerState.status === "visitor" && <FreePlan prices={prices} viewerState={viewerState} />}
      </BillingCurrencyScope>

      <PlusQuestions className="max-w-form" hasNoAccount={hasNoAccount(viewerState)} />
    </>
  );
}

/** The Plus offer while the reader's prices load. */
export function PlusPricingSkeleton() {
  return (
    <div aria-hidden="true" className="max-w-form">
      <PlanCardSkeleton />
    </div>
  );
}
