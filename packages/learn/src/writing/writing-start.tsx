"use client";

import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { StepDetail, StepHeader, StepTitle } from "../_components/step-card";
import { TaskHeaderTitle } from "../_components/task-header";
import { TaskActions } from "../_components/task-layout";
import { WritingWait } from "../generation/writing-wait";
import { useLearnAnalytics } from "../learn-context";
import { TaskFrame, TaskMainButton } from "../shell/task-frame";
import { WritingRefused } from "./writing-refused";
import { type WritingStartAnswer } from "./writing-screen";

export type WritingStartState = { generationId: string } | { status: "failed" | "limitReached" };

function useWaitViewed(generationId: string | null) {
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

/**
 * Before the question exists: it's being written, its writing failed, or the day's extra grades
 * are used. Asking again is always the learner's tap, or the run they started ending.
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

  useWaitViewed(generationId);

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

    setState({ status: answer.status === "limitReached" ? "limitReached" : "failed" });
    return null;
  }

  if ("status" in state && state.status === "limitReached") {
    return <WritingRefused hrefs={hrefs} onContinue={finish} task={null} />;
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
      headerTitle={<TaskHeaderTitle title={t("Written answer")} />}
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
