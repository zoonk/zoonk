"use client";

import { useExtracted } from "next-intl";
import {
  type GenerationFirstLesson,
  type GenerationRun,
  toHeldRun,
} from "../../generation/generation-run";
import { GenerationWait } from "../../generation/generation-wait";
import { FirstLessonRow } from "../../wait/first-lesson-row";
import { WaitHeading } from "./wait-parts";
import { isRunStopped } from "./wait-run";

/** Where the learner goes once the plan is ready: the time question, or the plan itself. */
export type PlanNext = "plan" | "timeQuestion";

export function PlanReadyHeading({ next }: { next: PlanNext }) {
  const t = useExtracted();

  return (
    <WaitHeading
      description={next === "timeQuestion" ? t("One last question, then you'll see it.") : null}
      title={t("Your plan is ready")}
    />
  );
}

/** The plan build's progress view: its steps, then lesson 1 being written alongside it. */
export function PlanBuilding({
  firstLesson,
  holding,
  next,
  run,
  since,
}: {
  firstLesson: GenerationFirstLesson | null;
  holding: boolean;
  next: PlanNext;
  run: GenerationRun;
  since: number;
}) {
  const t = useExtracted();

  return (
    <>
      <GenerationWait
        doneLabel={holding ? t("Your plan is ready") : undefined}
        kind="curriculum"
        run={holding ? toHeldRun(run) : run}
        since={since}
      >
        {holding ? (
          <PlanReadyHeading next={next} />
        ) : (
          <WaitHeading
            description={
              isRunStopped(run) ? t("Your answers are saved.") : t("This takes a minute or two.")
            }
            title={t("Building your plan")}
          />
        )}
      </GenerationWait>

      {firstLesson && <FirstLessonRow lesson={firstLesson} run={run} />}
    </>
  );
}
