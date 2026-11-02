import { Link } from "@/i18n/navigation";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { TodayAtRest } from "@zoonk/learn/today/at-rest";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ListChecksIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

export async function isOnboardingLeft(goalId: string): Promise<boolean> {
  const result = await getOnboarding({ goalId });
  return result.status === "ready" && result.onboarding.steps.some((step) => step !== "plan");
}

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
