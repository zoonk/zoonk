import { Link } from "@/i18n/navigation";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { getGoalResumePreview } from "@zoonk/core/plans/resume-preview";
import { EnterLink } from "@zoonk/learn/enter-button";
import { ResumeEffect } from "@zoonk/learn/journey/resume-effect";
import { TodayAtRest } from "@zoonk/learn/today/at-rest";
import { buttonVariants } from "@zoonk/ui/components/button";
import { FlagIcon, PauseIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { ResumeGoalButton } from "./resume-goal-button";

async function loadResumePreview(goal: { id: string; status: string } | undefined) {
  if (goal?.status !== "paused") {
    return false;
  }

  const result = await getGoalResumePreview(goal.id);
  return result.status === "ready" ? result.preview : false;
}

export async function TodayGoalPaused({ banner }: { banner: React.ReactNode }) {
  const t = await getExtracted();
  const list = await listCurrentUserGoals();
  const goal = list?.goals.find((item) => item.id === list.activeGoalId);
  const resume = await loadResumePreview(goal);

  if (goal?.status === "completed") {
    return (
      <TodayAtRest
        banner={banner}
        actions={
          <EnterLink href="/start" icon={null} size="lg">
            {t("Start a new goal")}
          </EnterLink>
        }
        clause={t("Start a new goal, or pick another one above.")}
        icon={<FlagIcon />}
        sentence={t("You finished your {goal} goal.", { goal: goal.displayName })}
        state={t("Finished")}
        title={t("Today")}
      />
    );
  }

  return (
    <TodayAtRest
      banner={banner}
      actions={
        <>
          {goal && <ResumeGoalButton goalId={goal.id} goalTitle={goal.displayName} key={goal.id} />}
          <Link
            className={buttonVariants({ size: "lg", variant: goal ? "outline" : "default" })}
            href="/start"
          >
            {t("New goal")}
          </Link>
        </>
      }
      clause={t("Nothing is planned until you resume it.")}
      detail={<ResumeEffect preview={resume} />}
      icon={<PauseIcon />}
      sentence={
        goal
          ? t("Your {goal} goal is paused.", { goal: goal.displayName })
          : t("This goal is paused.")
      }
      state={t("Paused")}
      title={t("Today")}
    />
  );
}
