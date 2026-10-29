import {
  EYEBROW_CLASS,
  LEAD_CLASS,
  PUBLIC_CONTAINER_CLASS,
} from "@/components/public/landing-styles";
import { getStartControlClassName } from "@/components/public/public-start";
import { Link } from "@/i18n/navigation";
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
      "Get ready for your exam, new job or move with Zoonk Plus: unlimited lessons and goals, full exam prep with mock exams and your AI study buddy. Start free.",
    ),
    title: t("Zoonk Plus: plans and pricing"),
  };
}

function renderRest(chunks: ReactNode) {
  return <span className="text-muted-foreground">{chunks}</span>;
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
        {t.rich("Start free. <rest>Plus when you want everything.</rest>", { rest: renderRest })}
      </h1>

      <p className={cn(LEAD_CLASS, "mt-4.5")}>
        {t("Free covers one goal at a time. Plus covers every goal, all the way to the big day.")}
      </p>
    </section>
  );
}

const PRICING_BILLING_SWITCH = "pricing-billing";

const PLANS_GRID_CLASS = "grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5";

export function PricingPlans({
  monthlyPrice,
  yearlyPrice,
}: {
  monthlyPrice: PriceInfo | null;
  yearlyPrice: PriceInfo | null;
}) {
  const currency = (monthlyPrice ?? yearlyPrice)?.currency ?? null;

  return (
    <div className={cn(PUBLIC_CONTAINER_CLASS, "pt-12 pb-14 sm:pb-20 lg:pb-24")}>
      <div className={PLANS_GRID_CLASS}>
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
    <div className={cn(PUBLIC_CONTAINER_CLASS, "pt-24 lg:pt-32")}>
      <PlusQuestions
        className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12"
        freePlanShown
      />
    </div>
  );
}

async function VisitorPricingClose({ hasChoice }: { hasChoice: boolean }) {
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
  viewerState,
  yearlyPrice,
}: {
  defaultPeriod?: BillingPeriod;
  monthlyPrice: PriceInfo | null;
  viewerState: PlusViewerState;
  yearlyPrice: PriceInfo | null;
}) {
  const currency = (monthlyPrice ?? yearlyPrice)?.currency ?? null;
  const freePlanShown = viewerState.status === "visitor";

  return (
    <>
      <div className="max-w-form flex flex-col gap-4">
        <PlusPlan
          billingSwitch="subscription-billing"
          defaultPeriod={defaultPeriod}
          monthlyPrice={monthlyPrice}
          viewerState={viewerState}
          yearlyPrice={yearlyPrice}
        />

        {freePlanShown && <FreePlan currency={currency} viewerState={viewerState} />}
      </div>

      <PlusQuestions
        className="max-w-form"
        freePlanShown={freePlanShown}
        viewerState={viewerState}
      />
    </>
  );
}

export function PlusPricingSkeleton() {
  return (
    <div aria-hidden="true" className="max-w-form">
      <PlanCardSkeleton />
    </div>
  );
}
