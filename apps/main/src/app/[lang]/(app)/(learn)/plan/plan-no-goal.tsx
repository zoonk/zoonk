import { getSession } from "@zoonk/core/users/session";
import { Page, PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { getExtracted } from "next-intl/server";
import { LearnNoGoal } from "../_components/learn-no-goal";
import { PlanGoalStart } from "./plan-goal-start";

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

  return (
    <Page data-slot="journey-no-goal">
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>{t("Plan")}</PageTitle>
          <PageSubtitle>
            {t("Tell us what you want to learn, and we'll plan every day until you get there.")}
          </PageSubtitle>
        </PageHeaderContent>
      </PageHeader>

      <div className="max-w-column">
        <PlanGoalStart />
      </div>
    </Page>
  );
}
