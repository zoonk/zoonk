"use client";

import { useRouter } from "@/i18n/navigation";
import { GoalBox } from "@zoonk/learn/onboarding/goal-box";
import { GoalFieldSubmit, useGoalFieldAction } from "@zoonk/learn/onboarding/goal-field";
import { useExtracted } from "next-intl";

/** Reading the goal waits for the learner's confirmation in onboarding. */
export function PlanGoalStart() {
  const t = useExtracted();
  const router = useRouter();

  const goal = useGoalFieldAction({
    onSend: (words) => router.push(`/start?goal=${encodeURIComponent(words)}`),
  });

  return (
    <GoalBox goal={goal}>
      <GoalFieldSubmit>{t("Build my plan")}</GoalFieldSubmit>
    </GoalBox>
  );
}
