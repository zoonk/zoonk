"use client";

import { CircleSlash2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { StepDetail, StepHeader, StepTitle } from "../_components/step-card";
import { TaskHeaderTitle } from "../_components/task-header";
import { TaskActions, TaskStopMessage } from "../_components/task-layout";
import { WritingWait } from "../generation/writing-wait";
import { useLearnAnalytics } from "../learn-context";
import { TaskFrame, TaskMainButton, TaskMainLink } from "../shell/task-frame";
import { WritingRefused } from "./writing-refused";
import { type WritingStartAnswer } from "./writing-screen";
import { type TomorrowTask } from "./writing-types";

export type WritingStartState =
  | { generationId: string }
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
    task: task ? { minutes: task.minutes, title: task.description, unit: task.unit } : null,
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
          description={t("The exam notice changed. Nothing was counted.")}
          heading="h1"
          icon={<CircleSlash2Icon aria-hidden="true" />}
          title={t("This task is no longer on your exam")}
        />
      </div>
    </TaskFrame>
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
      setState({ generationId: answer.generationId });
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

  const header = (
    <StepHeader className="gap-3">
      <StepTitle>{t("Writing your question…")}</StepTitle>
      <StepDetail>
        {t("A new question, like the ones on your exam. It opens here when it's ready.")}
      </StepDetail>
    </StepHeader>
  );

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
      headerTitle={<TaskHeaderTitle title={t("Writing practice")} />}
    >
      {generationId ? (
        <WritingWait
          kind="writingPrompt"
          writing={{ generationId, onReady: () => void ask(), restart: ask }}
        >
          {header}
        </WritingWait>
      ) : (
        <StepHeader className="gap-3">
          <StepTitle>{t("We couldn't write your question")}</StepTitle>
          <StepDetail>{t("Nothing was lost. Try again in a moment.")}</StepDetail>
        </StepHeader>
      )}
    </TaskFrame>
  );
}
