import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import {
  SEGMENTED_OPTION_CLASS,
  SEGMENTED_TRACK_CLASS,
  Variant,
  VariantSwitch,
  VariantSwitchOption,
} from "@/components/public/variant-switch";
import { Link, getPathname } from "@/i18n/navigation";
import { SURFACE_CLASS } from "@zoonk/learn/surface";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type PriceInfo } from "@zoonk/utils/currency";
import { getExtracted, getLocale } from "next-intl/server";
import { getMonthlyEquivalent, getYearlyPriceComparison } from "./billing-prices";
import { PlanNextStep } from "./for-viewer";
import { PLAN_CARD_CLASS, PLAN_NAME_ROW_CLASS, PLAN_PRICE_CLASS, PlanPrice } from "./plan-includes";
import { formatPlanPrice } from "./plan-price";
import { PlusBenefits } from "./plus-benefits";
import { PLAN_ACTION_NOTE_CLASS, PLUS_CTA_CLASS } from "./plus-cta";
import { SubscribeButton } from "./subscribe-button";

export type PlusViewerState =
  | { status: "free" }
  | { status: "guest" }
  | { status: "subscribed" }
  | { status: "visitor" };

const PERIODS = ["monthly", "yearly"] as const;
const DEFAULT_PERIOD = "monthly";
const PLUS_PLAN_ID = "plus-plan";

export type BillingPeriod = (typeof PERIODS)[number];

export const BILLING_PERIOD_PARAM = "period";

export function readBillingPeriod(value: string | string[] | undefined): BillingPeriod {
  return value === "yearly" ? "yearly" : DEFAULT_PERIOD;
}

export async function PlusLoginLink({
  billingSwitch,
  className,
  hasChoice,
}: {
  billingSwitch: string;
  className?: string;
  hasChoice: boolean;
}) {
  const t = await getExtracted();
  const locale = await getLocale();
  const login = getPathname({ href: "/login", locale });
  const subscription = getPathname({ href: "/subscription", locale });

  const getHref = (period?: BillingPeriod) => {
    const next = period ? `${subscription}?${BILLING_PERIOD_PARAM}=${period}` : subscription;
    return `${login}?next=${encodeURIComponent(next)}`;
  };

  if (!hasChoice) {
    return (
      <a className={className} href={getHref()}>
        {t("Get Plus")}
      </a>
    );
  }

  return PERIODS.map((period) => (
    <Variant as="span" className="contents" key={period} name={billingSwitch} value={period}>
      <a className={className} href={getHref(period)}>
        {t("Get Plus")}
      </a>
    </Variant>
  ));
}

function renderMono(chunks: React.ReactNode) {
  return <span className={NUMERIC_CLASS}>{chunks}</span>;
}

async function PlusAction({
  billingSwitch,
  hasChoice,
  viewerState,
}: {
  billingSwitch: string;
  hasChoice: boolean;
  viewerState: PlusViewerState;
}) {
  const t = await getExtracted();

  if (viewerState.status === "free") {
    return <SubscribeButton billingSwitch={billingSwitch} />;
  }

  if (viewerState.status === "subscribed") {
    return (
      <Link
        className={cn(buttonVariants({ size: "lg", variant: "outline" }), PLUS_CTA_CLASS)}
        href="/subscription"
      >
        {t("Manage your plan")}
      </Link>
    );
  }

  return (
    <PlusLoginLink
      billingSwitch={billingSwitch}
      className={cn(buttonVariants({ size: "lg" }), PLUS_CTA_CLASS)}
      hasChoice={hasChoice}
    />
  );
}

async function PlusPrices({
  billingSwitch,
  monthlyPrice,
  yearlyPrice,
}: {
  billingSwitch: string;
  monthlyPrice: PriceInfo | null;
  yearlyPrice: PriceInfo | null;
}) {
  const t = await getExtracted();
  const locale = await getLocale();
  const monthlyEquivalent = getMonthlyEquivalent({ yearlyPrice });

  if (!monthlyPrice) {
    return <p className="text-muted-foreground text-sm">{t("Price shown at checkout")}</p>;
  }

  const monthly = (
    <>
      <PlanPrice amount={formatPlanPrice({ locale, price: monthlyPrice })} per={t("per month")} />
      <p className="text-muted-foreground text-[0.8125rem]">{t("Billed every month.")}</p>
    </>
  );

  if (!yearlyPrice || !monthlyEquivalent) {
    return monthly;
  }

  return (
    <>
      <Variant className="flex flex-col gap-2" name={billingSwitch} value="monthly">
        {monthly}
      </Variant>

      <Variant className="flex flex-col gap-2" name={billingSwitch} value="yearly">
        <PlanPrice amount={formatPlanPrice({ locale, price: yearlyPrice })} per={t("per year")} />
        <p className="text-muted-foreground text-[0.8125rem]">
          {t.rich("That's <mono>{amount}</mono> a month.", {
            amount: formatPlanPrice({ locale, price: monthlyEquivalent }),
            mono: renderMono,
          })}
        </p>
      </Variant>
    </>
  );
}

/** `billingSwitch` must be unique: the router may keep the pricing and subscription pages in the document together. */
export async function PlusPlan({
  billingSwitch,
  defaultPeriod = DEFAULT_PERIOD,
  monthlyPrice,
  viewerState,
  yearlyPrice,
}: {
  billingSwitch: string;
  defaultPeriod?: BillingPeriod;
  monthlyPrice: PriceInfo | null;
  viewerState?: PlusViewerState;
  yearlyPrice: PriceInfo | null;
}) {
  const t = await getExtracted();
  const locale = await getLocale();
  const comparison = getYearlyPriceComparison({ monthlyPrice, yearlyPrice });
  const hasChoice = Boolean(monthlyPrice && yearlyPrice);

  return (
    <section
      aria-labelledby={PLUS_PLAN_ID}
      className={cn(SURFACE_CLASS, PLAN_CARD_CLASS, "ring-foreground/25")}
    >
      <div className={PLAN_NAME_ROW_CLASS}>
        <h2 className="text-base font-semibold tracking-[-0.015em]" id={PLUS_PLAN_ID}>
          {t("Plus")}
        </h2>

        {hasChoice && (
          <VariantSwitch
            aria-label={t("Billing period")}
            className={SEGMENTED_TRACK_CLASS}
            defaultValue={defaultPeriod}
            name={billingSwitch}
            values={PERIODS}
          >
            <VariantSwitchOption
              className={SEGMENTED_OPTION_CLASS}
              defaultValue={defaultPeriod}
              name={billingSwitch}
              value="monthly"
            >
              {t("Monthly")}
            </VariantSwitchOption>

            <VariantSwitchOption
              className={SEGMENTED_OPTION_CLASS}
              defaultValue={defaultPeriod}
              name={billingSwitch}
              value="yearly"
            >
              {t("Yearly")}
              {comparison && (
                <span className="text-muted-foreground font-normal">
                  {t("save {amount}", {
                    amount: formatPlanPrice({ locale, price: comparison.savings }),
                  })}
                </span>
              )}
            </VariantSwitchOption>
          </VariantSwitch>
        )}
      </div>

      <div className={PLAN_PRICE_CLASS}>
        <PlusPrices
          billingSwitch={billingSwitch}
          monthlyPrice={monthlyPrice}
          yearlyPrice={yearlyPrice}
        />
      </div>

      <PlanNextStep
        render={(reader) => (
          <>
            <PlusAction billingSwitch={billingSwitch} hasChoice={hasChoice} viewerState={reader} />
            <p className={PLAN_ACTION_NOTE_CLASS}>{t("Cancel anytime.")}</p>
          </>
        )}
        viewerState={viewerState}
      />

      <div className="mt-6 border-t pt-5">
        <PlusBenefits />
      </div>
    </section>
  );
}
