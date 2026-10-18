import { Link } from "@/i18n/navigation";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { TodayAtRest } from "@zoonk/learn/today/at-rest";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ListChecksIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/**
 * Whether the goal the tabs show still has onboarding questions before its plan: the learner left
 * them for another page of the app, whose tabs stay in reach while they answer. Read as the Plan
 * reads it, so both say the same.
 */
export async function isOnboardingLeft(goalId: string): Promise<boolean> {
  const result = await getOnboarding({ goalId });
  return result.status === "ready" && result.onboarding.steps.some((step) => step !== "plan");
}

/**
 * Today for a goal whose questions were left halfway: its plan is built from the answers, so
 * instead of a wait for a plan that won't come, Today says what's missing and leads back to the
 * question the learner left.
 */
export async function TodayOnboardingLeft({ goal }: { goal: { id: string; title: string } }) {
  const t = await getExtracted();

  return (
    <TodayAtRest
      actions={
        <Link className={buttonVariants({ size: "lg" })} href={`/start/${goal.id}`}>
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
