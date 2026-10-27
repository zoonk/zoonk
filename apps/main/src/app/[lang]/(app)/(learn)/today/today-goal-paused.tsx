import { Link } from "@/i18n/navigation";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { getGoalResumePreview } from "@zoonk/core/plans/resume-preview";
import { ResumeEffect } from "@zoonk/learn/journey/resume-effect";
import { TodayAtRest } from "@zoonk/learn/today/at-rest";
import { buttonVariants } from "@zoonk/ui/components/button";
import { FlagIcon, PauseIcon } from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";
import { ResumeGoalButton } from "./resume-goal-button";
import { getLocalDay } from "./today-local-day";

/** What resuming the paused goal would do to its plan, read only for a paused goal. */
async function loadResumePreview(goal: { id: string; status: string } | undefined) {
  if (goal?.status !== "paused") {
    return null;
  }

  const result = await getGoalResumePreview(goal.id);
  return result.status === "ready" ? result.preview : null;
}

/**
 * The goal the tabs show is paused (or finished): nothing is planned for it today. Today keeps its
 * frame and says so in one line; a paused goal comes back with one tap, a new goal is the other
 * way on. When the pause left lessons behind, what resuming moves shows before the tap.
 */
export async function TodayGoalPaused() {
  const t = await getExtracted();
  const locale = await getLocale();
  const list = await listCurrentUserGoals();
  const goal = list?.goals.find((item) => item.id === list.activeGoalId);

  // The date line formats with next-intl, so it's read on its own, before the preview.
  const date = await getLocalDay({ locale, timeZone: goal?.timezone ?? null });
  const resume = await loadResumePreview(goal);

  if (goal?.status === "completed") {
    return (
      <TodayAtRest
        actions={
          <Link className={buttonVariants({ size: "lg" })} href="/start">
            {t("Start a new goal")}
          </Link>
        }
        clause={t("Start a new goal, or pick another one above.")}
        date={date}
        icon={<FlagIcon />}
        sentence={t("You finished {goal}.", { goal: goal.title })}
        state={t("Finished")}
        title={t("Today")}
      />
    );
  }

  return (
    <TodayAtRest
      actions={
        <>
          {goal && <ResumeGoalButton goalId={goal.id} goalTitle={goal.title} key={goal.id} />}
          <Link
            className={buttonVariants({ size: "lg", variant: goal ? "outline" : "default" })}
            href="/start"
          >
            {t("New goal")}
          </Link>
        </>
      }
      clause={t("Nothing is planned until you resume it.")}
      date={date}
      detail={<ResumeEffect preview={resume} />}
      icon={<PauseIcon />}
      sentence={goal ? t("{goal} is paused.", { goal: goal.title }) : t("This goal is paused.")}
      state={t("Paused")}
      title={t("Today")}
    />
  );
}
