import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { hasOnboardingQuestions } from "@zoonk/core/view-models/onboarding/steps";
import { EnterLink } from "@zoonk/learn/enter-button";
import { TodayAtRest } from "@zoonk/learn/today/at-rest";
import { ListChecksIcon, MapIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

type OnboardingLeft = "questions" | "reveal";

/** Null while the plan is still being made: Today then follows its build like any other. */
export async function readOnboardingLeft(goalId: string): Promise<OnboardingLeft | null> {
  const result = await getOnboarding({ goalId });

  if (result.status !== "ready") {
    return null;
  }

  const { planReadiness, planRevealed, steps } = result.onboarding;

  if (hasOnboardingQuestions(steps)) {
    return "questions";
  }

  return planReadiness.ready && !planRevealed ? "reveal" : null;
}

export async function TodayOnboardingLeft({
  banner,
  goal,
  left,
}: {
  banner: React.ReactNode;
  goal: { displayName: string; id: string; title: string };
  left: OnboardingLeft;
}) {
  const t = await getExtracted();
  const href = `/start/${goal.id}`;

  if (left === "reveal") {
    return (
      <TodayAtRest
        banner={banner}
        actions={
          <EnterLink href={href} size="lg">
            {t("See your plan")}
          </EnterLink>
        }
        icon={<MapIcon />}
        sentence={t("Your {goal} plan is ready.", { goal: goal.displayName })}
        title={t("Today")}
      />
    );
  }

  return (
    <TodayAtRest
      banner={banner}
      actions={
        <EnterLink href={href} size="lg">
          {t("Continue")}
        </EnterLink>
      }
      icon={<ListChecksIcon />}
      sentence={t("Your {goal} plan needs a few more answers.", { goal: goal.displayName })}
      title={t("Today")}
    />
  );
}
