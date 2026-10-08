import { Link } from "@/i18n/navigation";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { FlagIcon, PauseIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { ResumeGoalButton } from "./resume-goal-button";

/** A finished goal has nothing left to plan: a new goal is the next step. */
async function GoalFinished({ title }: { title: string }) {
  const t = await getExtracted();

  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FlagIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>
          <h1>{t("You finished {goal}", { goal: title })}</h1>
        </EmptyTitle>
        <EmptyDescription>{t("Start a new goal, or pick another one above.")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link className={buttonVariants()} href="/start">
          {t("Start a new goal")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}

/**
 * The goal the tabs show is paused (or finished): nothing is planned for it today. A paused goal
 * comes back with one tap; a new goal is the other way on.
 */
export async function TodayGoalPaused() {
  const t = await getExtracted();
  const list = await listCurrentUserGoals();
  const goal = list?.goals.find((item) => item.id === list.activeGoalId);

  if (goal?.status === "completed") {
    return <GoalFinished title={goal.title} />;
  }

  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PauseIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>
          <h1>
            {goal ? t("{goal} is on pause", { goal: goal.title }) : t("This goal is on pause")}
          </h1>
        </EmptyTitle>
        <EmptyDescription>
          {t("Nothing is planned for it today. Resume it to plan your days again.")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {goal && <ResumeGoalButton goalId={goal.id} />}
        <Link className={buttonVariants({ variant: goal ? "ghost" : "default" })} href="/start">
          {t("Start a new goal")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
