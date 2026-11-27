import { setGoalStatusAction } from "@/app/[lang]/(app)/(learn)/_components/goal-status-action";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { getGoalResumePreview } from "@zoonk/core/plans/resume-preview";
import { EnterLink } from "@zoonk/learn/enter-button";
import { ResumeEffect } from "@zoonk/learn/journey/resume-effect";
import { ResumeGoalBar } from "@zoonk/learn/journey/resume-goal-bar";
import {
  NoticeCard,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardTitle,
} from "@zoonk/learn/notice";
import { Page } from "@zoonk/learn/page";
import { TodayAtRest, TodayPageHeader, TodayPractice } from "@zoonk/learn/today/at-rest";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { buttonVariants } from "@zoonk/ui/components/button";
import { FlagIcon, PauseIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { loadTodayPractice } from "./today-view";

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

  const [resume, practice] = await Promise.all([
    loadResumePreview(goal),
    goal?.status === "paused" ? loadTodayPractice(goal.id) : null,
  ]);

  return (
    <Page className="gap-5" data-slot="today-goal-at-rest">
      {banner}
      <TodayPageHeader title={t("Today")} />

      <NoticeCard>
        <PauseIcon aria-hidden="true" />
        <NoticeCardContent>
          <NoticeCardTitle>{t("This goal is paused.")}</NoticeCardTitle>
          {resume ? (
            <ResumeEffect preview={resume} />
          ) : (
            <NoticeCardDescription>
              {t("Nothing is planned until you resume it.")}
            </NoticeCardDescription>
          )}
        </NoticeCardContent>
      </NoticeCard>

      {practice && (
        <TodayPractice
          {...practice}
          className="min-[72rem]:flex"
          completedLessonsHref={getMenu("completedLessons").url}
          mistakesHref={getMenu("mistakes").url}
          savedLessonsHref={getMenu("savedLessons").url}
        />
      )}

      {goal ? (
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
      )}
    </Page>
  );
}
