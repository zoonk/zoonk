import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { Link } from "@/i18n/navigation";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { SURFACE_CLASS } from "@zoonk/learn/surface";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted, getLocale } from "next-intl/server";
import { PlanNextStep } from "./for-viewer";
import {
  PLAN_CARD_CLASS,
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
      <Link
        className={cn(buttonVariants({ size: "lg", variant: "outline" }), PLUS_CTA_CLASS)}
        href="/start"
      >
        {t("Start free")}
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

  if (viewerState.status === "free") {
    return (
      <p className="text-muted-foreground flex min-h-11 items-center justify-center text-sm">
        {t("Your current plan")}
      </p>
    );
  }

  return null;
}

export async function FreePlan({
  currency,
  viewerState,
}: {
  currency: string | null;
  viewerState?: PlusViewerState;
}) {
  const t = await getExtracted();
  const locale = await getLocale();
  const limits = getFreePlanLimits();

  return (
    <section aria-labelledby={FREE_PLAN_ID} className={cn(SURFACE_CLASS, PLAN_CARD_CLASS)}>
      <div className={PLAN_NAME_ROW_CLASS}>
        <h2 className="text-base font-semibold tracking-[-0.015em]" id={FREE_PLAN_ID}>
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
            <FreePlanAction viewerState={reader} />

            {(reader.status === "visitor" || reader.status === "guest") && (
              <p className={PLAN_ACTION_NOTE_CLASS}>{t("No card needed.")}</p>
            )}
          </>
        )}
        viewerState={viewerState}
      />

      <div className="mt-6 border-t pt-5">
        <PlanIncludes
          items={[
            { id: "plan", text: t("A plan for your goal and your date") },
            {
              id: "exam",
              text: t(
                "For an exam: the diagnostic, your plan and {days, plural, =7 {its first week} one {its first day} other {its first # days}}",
                { days: limits.examPrepDays ?? 0 },
              ),
            },
            {
              id: "buddy",
              text: t(
                "An AI study buddy: {count, plural, one {# message} other {# messages}} a day",
                { count: limits.tutorMessagesPerDay ?? 0 },
              ),
            },
            { id: "calls", text: t("Speaking practice calls, with lower limits than Plus") },
          ]}
          summary={t(
            "{goals, plural, one {# goal} other {# goals}} · {lessons, plural, one {# lesson} other {# lessons}} a month",
            { goals: limits.activeGoals ?? 0, lessons: limits.lessonsPerMonth ?? 0 },
          )}
        />
      </div>
    </section>
  );
}
