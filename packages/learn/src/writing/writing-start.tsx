"use client";

import { CircleSlash2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { StepDetail, StepHeader, StepTitle } from "../_components/step-card";
import { SignUpMainAction } from "../_components/subscribe-gate";
import { TaskHeaderTitle } from "../_components/task-header";
import { TaskActions, TaskStopMessage } from "../_components/task-layout";
import { useFormatDuration } from "../_utils/time-format";
import { useFinishTask } from "../essay/use-finish-essay";
import { FollowedRun } from "../generation/generation-follower";
import { type GenerationRun, hasStopped } from "../generation/generation-run";
import { IndeterminateWait } from "../generation/indeterminate-wait";
import { useLearnAnalytics } from "../learn-context";
import { TaskFrame, TaskMainButton } from "../shell/task-frame";
import { useWritingTaskTitle } from "./writing-header";
import { WritingRefused } from "./writing-refused";
import { type WritingStartAnswer } from "./writing-screen";
import { type TomorrowTask } from "./writing-types";

type WritingUnit = NonNullable<TomorrowTask["unit"]>;

export type WritingStartState =
  | { generationId: string; unit?: WritingUnit }
  | { status: "failed" | "signUpRequired" | "taskRemoved" | "unasked" }
  | { status: "limitReached"; task: TomorrowTask | null };

/** How a start answered, as the screen shows it; `ready` opens the question instead. */
export function toWritingStartState(
  answer: Exclude<WritingStartAnswer, { status: "ready" }>,
): WritingStartState {
  if (answer.status === "writing") {
    return { generationId: answer.generationId, unit: answer.unit };
  }

  if (answer.status !== "limitReached") {
    return { status: answer.status };
  }

  const { task } = answer;

  return {
    status: "limitReached",
    task: task
      ? {
          minutes: task.minutes,
          title: task.description,
          unit: task.unit,
          writingTask: task.writingTask ?? null,
        }
      : null,
  };
}

/** Once per run a learner sees being written. */
function useWritingWaitViewed(generationId: string | null) {
  const { track } = useLearnAnalytics();

  useEffect(() => {
    if (generationId) {
      track({
        name: "Writing Prompt Wait Viewed",
        properties: { generation_id: generationId, surface: "practice" },
      });
    }
  }, [generationId, track]);
}

/** The exam's notice was read again and dropped this task: nothing was admitted, so the learner moves on. */
function WritingTaskRemoved({
  hrefs,
  onContinue,
}: {
  hrefs: { exit: string };
  onContinue: () => Promise<boolean>;
}) {
  const t = useExtracted();
  const finishing = useFinishTask(onContinue);

  return (
    <TaskFrame
      exitHref={hrefs.exit}
      footer={
        <TaskActions>
          <TaskMainButton busy={finishing.pending} onClick={() => void finishing.finish()}>
            {t("Continue")}
          </TaskMainButton>
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
function WritingPromptWait({ run, unit }: { run: GenerationRun; unit?: WritingUnit }) {
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

function StartMessage({ state, task }: { state: WritingStartState; task: TomorrowTask }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const writingTitle = useWritingTaskTitle();

  if ("status" in state && state.status === "signUpRequired") {
    return (
      <StepHeader className="gap-3">
        <StepTitle>{t("This needs a free account")}</StepTitle>
        <StepDetail>
          {task.unit === "drill"
            ? t("With one, we write your exercise and grade what you write.")
            : t("With one, we write your question and grade what you write.")}
        </StepDetail>
      </StepHeader>
    );
  }

  if ("status" in state && state.status === "failed") {
    return (
      <StepHeader className="gap-3">
        <StepTitle>
          {task.unit === "drill"
            ? t("We couldn't write your exercise")
            : t("We couldn't write your question")}
        </StepTitle>
        <StepDetail>{t("Nothing was lost. Try again in a moment.")}</StepDetail>
      </StepHeader>
    );
  }

  return (
    <StepHeader className="gap-3">
      <StepTitle>{writingTitle({ ...task, task: task.writingTask })}</StepTitle>
      {task.minutes !== null && (
        <StepDetail>{t("About {time}", { time: formatDuration(task.minutes) })}</StepDetail>
      )}
    </StepHeader>
  );
}

function StartAction({
  asking,
  onAsk,
  state,
}: {
  asking: boolean;
  onAsk: () => void;
  state: WritingStartState;
}) {
  const t = useExtracted();

  if ("status" in state && state.status === "signUpRequired") {
    return <SignUpMainAction />;
  }

  return (
    <TaskActions>
      <TaskMainButton busy={asking} onClick={onAsk}>
        {"status" in state && state.status === "failed" ? t("Try again") : t("Write")}
      </TaskMainButton>
    </TaskActions>
  );
}

/**
 * Before the question exists: it's being written, its writing failed, the day's extra grades are
 * used, the task left the exam, or nothing was asked yet in this tab. Asking is always the
 * learner's tap here, or the run their tap started ending.
 */
export function WritingStartScreen({
  finish,
  hrefs,
  initial,
  onReady,
  start,
  task,
}: {
  finish: () => Promise<boolean>;
  hrefs: { exit: string };
  initial: WritingStartState;
  /** The question is ready: read the page again. */
  onReady: () => void;
  start: () => Promise<WritingStartAnswer>;
  task: TomorrowTask;
}) {
  const t = useExtracted();
  const [state, setState] = useState(initial);
  const [asking, setAsking] = useState(false);
  const generationId = "generationId" in state ? state.generationId : null;
  const unit = ("unit" in state ? state.unit : undefined) ?? task.unit;

  useWritingWaitViewed(generationId);

  async function ask(): Promise<string | null | undefined> {
    setAsking(true);
    const answer = await start().catch(() => ({ status: "failed" as const }));
    setAsking(false);

    if (answer.status === "ready") {
      onReady();
      return undefined;
    }

    const next = toWritingStartState(answer);
    setState("generationId" in next ? { ...next, unit: next.unit ?? unit } : next);
    return "generationId" in next ? next.generationId : null;
  }

  if ("status" in state && state.status === "limitReached") {
    return <WritingRefused hrefs={hrefs} onContinue={finish} task={state.task ?? task} />;
  }

  if ("status" in state && state.status === "taskRemoved") {
    return <WritingTaskRemoved hrefs={hrefs} onContinue={finish} />;
  }

  const headerTitle = (
    <TaskHeaderTitle title={unit === "drill" ? t("Writing practice") : t("Written answer")} />
  );

  if (generationId) {
    return (
      <FollowedRun
        generationId={generationId}
        key={generationId}
        kind="writingPrompt"
        onReady={() => void ask()}
        restart={ask}
      >
        {(run) => (
          <TaskFrame
            exitHref={hrefs.exit}
            footer={
              hasStopped(run) && (
                <TaskActions>
                  <TaskMainButton onClick={() => run.retry?.()}>{t("Try again")}</TaskMainButton>
                </TaskActions>
              )
            }
            headerTitle={headerTitle}
          >
            <WritingPromptWait run={run} unit={unit} />
          </TaskFrame>
        )}
      </FollowedRun>
    );
  }

  return (
    <TaskFrame
      exitHref={hrefs.exit}
      footer={<StartAction asking={asking} onAsk={() => void ask()} state={state} />}
      headerTitle={headerTitle}
    >
      <StartMessage state={state} task={task} />
    </TaskFrame>
  );
}
