import { setGoalStatusAction } from "@/app/[lang]/(app)/(learn)/_components/goal-status-action";
import { Link } from "@/i18n/navigation";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { getGoalResumePreview } from "@zoonk/core/plans/resume-preview";
import { EnterLink } from "@zoonk/learn/enter-button";
import { ResumeEffect } from "@zoonk/learn/journey/resume-effect";
import { ResumeGoalBar } from "@zoonk/learn/journey/resume-goal-bar";
import { TodayAtRest } from "@zoonk/learn/today/at-rest";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { buttonVariants } from "@zoonk/ui/components/button";
import { FlagIcon, PauseIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

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
        bottomBar={
          <BottomBar>
            <BottomBarActions>
              <EnterLink href="/start">{t("New goal")}</EnterLink>
            </BottomBarActions>
          </BottomBar>
        }
        icon={<FlagIcon />}
        sentence={t("You finished your {goal} goal.", { goal: goal.displayName })}
        title={t("Today")}
      />
    );
  }

  return (
    <TodayAtRest
      banner={banner}
      bottomBar={
        goal ? (
          <ResumeGoalBar key={goal.id} onResume={setGoalStatusAction.bind(null, goal.id, "active")}>
            <Link className={buttonVariants({ size: "xl", variant: "outline" })} href="/start">
              {t("New goal")}
            </Link>
          </ResumeGoalBar>
        ) : (
          <BottomBar>
            <BottomBarActions>
              <EnterLink href="/start">{t("New goal")}</EnterLink>
            </BottomBarActions>
          </BottomBar>
        )
      }
      clause={t("Nothing is planned until you resume it.")}
      detail={<ResumeEffect preview={resume} />}
      icon={<PauseIcon />}
      sentence={
        goal
          ? t("Your {goal} goal is paused.", { goal: goal.displayName })
          : t("This goal is paused.")
      }
      title={t("Today")}
    />
  );
}
