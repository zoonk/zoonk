"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { useExtracted } from "next-intl";
import { usePoll } from "../_utils/use-poll";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useRefreshUntilShown } from "../generation/use-refresh-until-shown";
import { useExperienceMode } from "../mode-provider";
import { FocusPlan } from "./focus-plan";
import { FunRoute } from "./fun-route";
import { type PlanActions, type PlanGoal, PlanScreenProvider } from "./plan-context";

export type { PlanActions, PlanEditOutcome } from "./plan-context";

/**
 * Stand-ins for lessons still being written are read again this often, so they turn into lessons
 * on their own; outlines take a minute or two each. `usePoll` stops after ten minutes.
 */
const WRITING_REFRESH_MS = 10_000;

/** A chapter or a week's stop still stands in for lessons being written. */
function isPlanBeingWritten(plan: PlanView): boolean {
  return (
    plan.phases.some((phase) => phase.chapters?.some((chapter) => chapter.writing)) ||
    plan.week.days.some((day) => day.items.some((item) => item.writing))
  );
}

/**
 * The plan while the goal's run builds it right after the goal is made: the run's progress as it
 * happens, turning into the plan on its own once it's saved (the host reads the plan again).
 */
export function PlanBuilding({ onRefresh, run }: { onRefresh: () => void; run: GenerationRun }) {
  const t = useExtracted();

  useRefreshUntilShown({ isReady: run.status === "ready", refresh: onRefresh });

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-8 py-12">
      <GenerationWait kind="curriculum" run={run}>
        <GenerationTimelineTitle>{t("Building your plan")}</GenerationTimelineTitle>
        <GenerationTimelineDescription>
          {t("It usually takes a minute or two. Your plan opens here as soon as it's ready.")}
        </GenerationTimelineDescription>
      </GenerationWait>
    </section>
  );
}

/**
 * The Plan tab (Route in Fun) once the plan exists (`PlanBuilding` before): one plan view model
 * from core, drawn as phases and chapters in Focus and as a route with moons in Fun. The host
 * passes its actions, already bound to the goal, and `refresh`, which reads the plan again while
 * lessons in it are still being written.
 */
export function PlanScreen({
  actions,
  chapterBasePath,
  courseHref,
  goal,
  mapHref,
  buddy = null,
  plan,
  refresh,
  shareHref,
  testOutBasePath,
  tutor,
}: {
  actions: PlanActions;
  /** Where a chapter's page lives: the chapter id is appended. */
  chapterBasePath?: string;
  /** The public page of the course the plan is built from. */
  courseHref?: string | null;
  goal: PlanGoal;
  /** The map of the goal's subject. */
  mapHref?: string;
  buddy?: LearnBuddy | null;
  plan: PlanView;
  refresh: () => void;
  shareHref: string;
  testOutBasePath: string;
  tutor?: React.ReactNode;
}) {
  const mode = useExperienceMode();

  usePoll({ active: isPlanBeingWritten(plan), intervalMs: WRITING_REFRESH_MS, onPoll: refresh });

  return (
    <PlanScreenProvider
      value={{
        actions,
        chapterBasePath,
        courseHref,
        goal,
        mapHref,
        plan,
        shareHref,
        testOutBasePath,
        tutor,
      }}
    >
      {mode === "fun" ? <FunRoute buddy={buddy} /> : <FocusPlan />}
    </PlanScreenProvider>
  );
}
