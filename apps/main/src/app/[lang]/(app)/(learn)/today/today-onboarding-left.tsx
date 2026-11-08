import { Link } from "@/i18n/navigation";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { TodayAtRest } from "@zoonk/learn/today/at-rest";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ListChecksIcon, MapIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

type OnboardingLeft = "questions" | "reveal";

export async function readOnboardingLeft(goalId: string): Promise<OnboardingLeft | null> {
  const result = await getOnboarding({ goalId });

  if (result.status !== "ready") {
    return null;
  }

  if (result.onboarding.steps.some((step) => step !== "plan")) {
    return "questions";
  }

  return result.onboarding.planRevealed ? null : "reveal";
}

export async function TodayOnboardingLeft({
  goal,
  left,
}: {
  goal: { id: string; title: string };
  left: OnboardingLeft;
}) {
  const t = await getExtracted();
  const href = `/start/${goal.id}`;

  if (left === "reveal") {
    return (
      <TodayAtRest
        actions={
          <Link className={buttonVariants({ size: "lg" })} href={href}>
            {t("See your plan")}
          </Link>
        }
        clause={t("Look it over before you start.")}
        date={null}
        icon={<MapIcon />}
        sentence={t("Your plan for {goal} is ready.", { goal: goal.title })}
        state={t("Plan ready")}
        title={t("Today")}
      />
    );
  }

  return (
    <TodayAtRest
      actions={
        <Link className={buttonVariants({ size: "lg" })} href={href}>
          {t("Continue setting up")}
        </Link>
      }
      clause={t("It's built from what you tell us.")}
      date={null}
      icon={<ListChecksIcon />}
      sentence={t("Your plan for {goal} needs a few more answers.", { goal: goal.title })}
      state={t("Setting up")}
      title={t("Today")}
    />
  );
}
