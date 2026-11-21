"use client";

import { CircleSlash2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { StepDetail, StepHeader, StepTitle } from "../_components/step-card";
import { TaskHeaderTitle } from "../_components/task-header";
import { TaskActions, TaskStopMessage } from "../_components/task-layout";
import { FollowedRun } from "../generation/generation-follower";
import { type GenerationRun } from "../generation/generation-run";
import { IndeterminateWait } from "../generation/indeterminate-wait";
import { useLearnAnalytics } from "../learn-context";
import { TaskFrame, TaskMainButton, TaskMainLink } from "../shell/task-frame";
import { readTaskPlace } from "./writing-header";
import { WritingRefused } from "./writing-refused";
import { type WritingStartAnswer } from "./writing-screen";
import { type TomorrowTask } from "./writing-types";

type WritingUnit = NonNullable<TomorrowTask["unit"]>;

export { type WritingTaskPlace, readTaskPlace } from "./writing-header";

export type WritingStartState =
  | { generationId: string; unit?: WritingUnit }
  | { status: "failed" | "taskRemoved" }
  | { status: "limitReached"; task: TomorrowTask | null };

function toStopState(
  answer: Exclude<WritingStartAnswer, { status: "ready" | "writing" }>,
): WritingStartState {
  if (answer.status === "taskRemoved") {
    return { status: "taskRemoved" };
  }

  if (answer.status !== "limitReached") {
    return { status: "failed" };
  }

  const { task } = answer;

  return {
    status: "limitReached",
    task: task
      ? {
          minutes: task.minutes,
          title: task.description,
          unit: task.unit,
          writingTask: readTaskPlace(task),
        }
      : null,
  };
}

/** Once per run a learner sees being written, from a question's start or a written test's. */
export function useWritingWaitViewed({
  generationId,
  surface,
}: {
  generationId: string | null;
  surface: "mock" | "practice";
}) {
  const { track } = useLearnAnalytics();

  useEffect(() => {
    if (generationId) {
      track({
        name: "Writing Prompt Wait Viewed",
        properties: { generation_id: generationId, surface },
      });
    }
  }, [generationId, surface, track]);
}

/** The exam's notice was read again and dropped this task: nothing was admitted, so only the way back is left. */
function WritingTaskRemoved({ hrefs }: { hrefs: { exit: string } }) {
  const t = useExtracted();

  return (
    <TaskFrame
      exitHref={hrefs.exit}
      footer={
        <TaskActions>
          <TaskMainLink href={hrefs.exit}>{t("Today")}</TaskMainLink>
        </TaskActions>
      }
      headerTitle={null}
    >
      <div className="flex flex-1 flex-col gap-6 pt-4 pb-8">
        <TaskStopMessage
          description={t("Your exam notice changed, so it's out of your plan. Nothing was graded.")}
          heading="h1"
          icon={<CircleSlash2Icon aria-hidden="true" />}
          title={t("This question is no longer on your exam")}
        />
      </div>
    </TaskFrame>
  );
}

/** One model call writes the question: the wait says what's coming, with no steps it doesn't have. */
export function WritingPromptWait({ run, unit }: { run: GenerationRun; unit?: WritingUnit }) {
  const t = useExtracted();

  return unit === "drill" ? (
    <IndeterminateWait
      description={t("A short exercise on what you just learned. It opens here when it's ready.")}
      failedTitle={t("We couldn't write your exercise")}
      run={run}
      title={t("Writing your exercise…")}
    />
  ) : (
    <IndeterminateWait
      description={t("A new question like the ones on your exam. It opens here when it's ready.")}
      failedTitle={t("We couldn't write your question")}
      run={run}
      title={t("Writing your question…")}
    />
  );
}

/**
 * Before the question exists: it's being written, its writing failed, the day's extra grades are
 * used, or the task left the exam. Asking again is always the learner's tap, or the run they started
 * ending.
 */
export function WritingStartScreen({
  finish,
  hrefs,
  initial,
  onReady,
  start,
}: {
  finish: () => Promise<boolean>;
  hrefs: { exit: string };
  initial: WritingStartState;
  /** The question is ready: read the page again. */
  onReady: () => void;
  start: () => Promise<WritingStartAnswer>;
}) {
  const t = useExtracted();
  const [state, setState] = useState(initial);
  const [asking, setAsking] = useState(false);
  const generationId = "generationId" in state ? state.generationId : null;
  const unit = "unit" in state ? state.unit : undefined;

  useWritingWaitViewed({ generationId, surface: "practice" });

  async function ask(): Promise<string | null | undefined> {
    setAsking(true);
    const answer = await start().catch(() => ({ status: "failed" as const }));
    setAsking(false);

    if (answer.status === "ready") {
      onReady();
      return undefined;
    }

    if (answer.status === "writing") {
      setState({ generationId: answer.generationId, unit: answer.unit ?? unit });
      return answer.generationId;
    }

    setState(toStopState(answer));
    return null;
  }

  if ("status" in state && state.status === "limitReached") {
    return <WritingRefused hrefs={hrefs} onContinue={finish} task={state.task} />;
  }

  if ("status" in state && state.status === "taskRemoved") {
    return <WritingTaskRemoved hrefs={hrefs} />;
  }

  return (
    <TaskFrame
      exitHref={hrefs.exit}
      footer={
        generationId ? null : (
          <TaskActions>
            <TaskMainButton busy={asking} onClick={() => void ask()}>
              {t("Try again")}
            </TaskMainButton>
          </TaskActions>
        )
      }
      headerTitle={
        <TaskHeaderTitle title={unit === "answer" ? t("Written answer") : t("Writing practice")} />
      }
    >
      {generationId ? (
        <FollowedRun
          generationId={generationId}
          key={generationId}
          kind="writingPrompt"
          onReady={() => void ask()}
          restart={ask}
        >
          {(run) => <WritingPromptWait run={run} unit={unit} />}
        </FollowedRun>
      ) : (
        <StepHeader className="gap-3">
          <StepTitle>{t("We couldn't write your question")}</StepTitle>
          <StepDetail>{t("Nothing was lost. Try again in a moment.")}</StepDetail>
        </StepHeader>
      )}
    </TaskFrame>
  );
}
