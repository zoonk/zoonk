import { Link } from "@/i18n/navigation";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { hasOnboardingQuestions } from "@zoonk/core/view-models/onboarding/steps";
import { TodayAtRest } from "@zoonk/learn/today/at-rest";
import { buttonVariants } from "@zoonk/ui/components/button";
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
          <Link className={buttonVariants({ size: "lg" })} href={href} prefetch>
            {t("See your plan")}
          </Link>
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
        <Link className={buttonVariants({ size: "lg" })} href={href} prefetch>
          {t("Continue")}
        </Link>
      }
      icon={<ListChecksIcon />}
      sentence={t("Your {goal} plan needs a few more answers.", { goal: goal.displayName })}
      title={t("Today")}
    />
  );
}
