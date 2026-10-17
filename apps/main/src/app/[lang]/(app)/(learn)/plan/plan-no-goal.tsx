import { getGoalExample } from "@/components/public/goal-example";
import { GoalForm } from "@/components/public/goal-form";
import { getPathname } from "@/i18n/navigation";
import { getSession } from "@zoonk/core/users/session";
import { Page, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { LearnNoGoal } from "../_components/learn-no-goal";

const PLAN_GOAL_ID = "plan-goal";

/**
 * The Plan without a goal to plan (none yet, or only quick explanations, which have no plan): the
 * page keeps its title, says what it holds, and the goal is written right here, as on the home
 * page, so the one next step is in place instead of behind another "Start a goal". Someone without
 * a session may have a goal in their account: they're asked to log in first.
 */
export async function PlanNoGoal() {
  const t = await getExtracted();
  const session = await getSession();

  if (!session) {
    return (
      <LearnNoGoal
        description={t("What you'll study each day until your goal, and what it covers.")}
        next="/plan"
        title={t("Plan")}
      />
    );
  }

  const locale = getSupportedLocaleFromLanguage(await lang());
  const example = await getGoalExample();

  return (
    <Page data-slot="journey-no-goal">
      <PageHeaderContent>
        <PageTitle>{t("Plan")}</PageTitle>
        <PageSubtitle>
          {t("Tell us what you want to learn, and we'll plan every day until you get there.")}
        </PageSubtitle>
      </PageHeaderContent>

      <div className="max-w-2xl">
        <GoalForm
          action={getPathname({ href: "/start", locale })}
          example={example}
          id={PLAN_GOAL_ID}
        />
      </div>
    </Page>
  );
}
