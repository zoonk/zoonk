import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { PageStartMark } from "@/components/public/page-start";
import { getAppLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { SURFACE_CLASS } from "@zoonk/learn/surface";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { PlanNextStep } from "./for-viewer";
import {
  PLAN_CARD_CLASS,
  PLAN_CARD_ROWS_CLASS,
  PLAN_NAME_ROW_CLASS,
  PLAN_PRICE_CLASS,
  PlanIncludes,
  PlanPrice,
} from "./plan-includes";
import { formatPlanPrice } from "./plan-price";
import { PLAN_ACTION_NOTE_CLASS, PLUS_CTA_CLASS } from "./plus-cta";
import { type PlusViewerState } from "./plus-plan";

const FREE_PLAN_ID = "free-plan";

async function FreePlanAction({ viewerState }: { viewerState: PlusViewerState }) {
  const t = await getExtracted();

  if (viewerState.status === "visitor") {
    return (
      <Link className={cn(buttonVariants({ size: "lg" }), PLUS_CTA_CLASS)} href="/start">
        {t("Build my plan")}
      </Link>
    );
  }

  if (viewerState.status === "guest") {
    return (
      <CurrentPageLoginLink
        className={cn(buttonVariants({ size: "lg", variant: "outline" }), PLUS_CTA_CLASS)}
      >
        {t("Create a free account")}
      </CurrentPageLoginLink>
    );
  }

  return (
    <p className="bg-muted text-muted-foreground flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-medium text-balance">
      {viewerState.status === "free"
        ? t({
            description:
              "On the Free card, in the button's place, for a learner who doesn't have Plus: it tells them this card is what they have today. Don't call it a “plan” or use your language's word for the learner's study plan.",
            message: "What you have now",
          })
        : t({
            description:
              "On the Free card, in the button's place, for a learner who has Plus: everything listed on this card is part of what they already have.",
            message: "Included in Plus",
          })}
    </p>
  );
}

export async function FreePlan({
  currency,
  usedToday,
  viewerState,
}: {
  currency: string | null;
  usedToday?: React.ReactNode;
  viewerState?: PlusViewerState;
}) {
  const t = await getExtracted();
  const locale = await getAppLocale();
  const limits = getFreePlanLimits();

  return (
    <section
      aria-labelledby={FREE_PLAN_ID}
      className={cn(SURFACE_CLASS, PLAN_CARD_CLASS, PLAN_CARD_ROWS_CLASS)}
    >
      <div className={PLAN_NAME_ROW_CLASS}>
        <h2 className="text-section" id={FREE_PLAN_ID}>
          {t("Free")}
        </h2>
      </div>

      <div className={PLAN_PRICE_CLASS}>
        {currency && (
          <PlanPrice amount={formatPlanPrice({ locale, price: { amount: 0, currency } })} />
        )}
      </div>

      <PlanNextStep
        render={(reader) => (
          <>
            <PageStartMark />
            <FreePlanAction viewerState={reader} />

            {(reader.status === "visitor" || reader.status === "guest") && (
              <p className={PLAN_ACTION_NOTE_CLASS}>{t("No card needed.")}</p>
            )}

            {reader.status === "free" && usedToday}
          </>
        )}
        viewerState={viewerState}
      />

      <div className="mt-6 border-t pt-5">
        <PlanIncludes
          items={[
            { id: "plan", text: t("A plan for your goal and your date") },
            {
              id: "buddy",
              text: t(
                "An AI study buddy: {count, plural, one {# message} other {# messages}} a day",
                { count: limits.tutorMessagesPerDay ?? 0 },
              ),
            },
            { id: "calls", text: t("Speaking practice calls") },
          ]}
          summary={t(
            "{goals, plural, one {# goal} other {# goals}} · {lessons, plural, one {# lesson} other {# lessons}} a month",
            { goals: limits.activeGoals ?? 0, lessons: limits.lessonsPer30Days ?? 0 },
          )}
        />
      </div>
    </section>
  );
}
