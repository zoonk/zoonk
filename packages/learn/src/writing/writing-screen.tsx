"use client";

import { type EssayDraft } from "@zoonk/core/exams/essays/contract";
import { type WritingPrompt } from "@zoonk/core/exams/essays/writing-contract";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { AnswersSaveError } from "../_components/save-error";
import { focusStepTitle } from "../_components/steps";
import { TaskHeaderTitle } from "../_components/task-header";
import { TaskActions } from "../_components/task-layout";
import { EssaySkipButton } from "../essay/essay-skip-button";
import { useFinishTask } from "../essay/use-finish-essay";
import { TaskFrame, TaskMainButton, TaskMainLink } from "../shell/task-frame";
import { type WritingDraftState, useWritingDraft } from "./use-writing-draft";
import { useHeaderLabel } from "./writing-header";
import { WritingQuestionScreen } from "./writing-question";
import { WritingRefused } from "./writing-refused";
import { WritingResultView } from "./writing-result";
import { type WritingActions, type WrittenEssay } from "./writing-types";
import { WriteScreen } from "./writing-write-screen";

export type { WritingActions, WritingDraftAnswer, WritingStartAnswer } from "./writing-types";

type Mode = "question" | "refused" | "result" | "write";

function ResultScreen({
  closed,
  finish,
  graded,
  hrefs,
  onRewrite,
  rewriting,
  writing,
}: {
  closed: boolean;
  finish: () => Promise<boolean>;
  graded: EssayDraft;
  hrefs: { exit: string };
  onRewrite: () => void;
  rewriting: boolean;
  writing: WritingPrompt;
}) {
  const t = useExtracted();
  const finishing = useFinishTask(finish);
  const label = useHeaderLabel(writing);

  useEffect(() => focusStepTitle(document.body), []);

  return (
    <TaskFrame
      exitHref={hrefs.exit}
      footer={
        <TaskActions>
          {closed ? (
            <TaskMainLink href={hrefs.exit}>{t("Today")}</TaskMainLink>
          ) : (
            <>
              <EssaySkipButton finishing={finishing} />
              <TaskMainButton busy={rewriting} onClick={onRewrite}>
                {t("Rewrite")}
              </TaskMainButton>
            </>
          )}
        </TaskActions>
      }
      footerNote={
        finishing.failures > 0 &&
        !finishing.pending && (
          <AnswersSaveError failures={finishing.failures} onRetry={() => void finishing.finish()} />
        )
      }
      headerTitle={<TaskHeaderTitle title={label} />}
    >
      <WritingResultView grade={graded.grade} prompt={writing} text={graded.text} />
    </TaskFrame>
  );
}

function QuestionScreen({
  draft,
  essay,
  hrefs,
  onWrite,
}: {
  draft: WritingDraftState;
  essay: WrittenEssay;
  hrefs: { exit: string };
  onWrite: () => void;
}) {
  const t = useExtracted();
  const label = useHeaderLabel(essay.writing);

  return (
    <TaskFrame
      exitHref={hrefs.exit}
      footer={
        <TaskActions>
          <TaskMainButton onClick={onWrite}>
            {draft.text.trim() ? t("Continue") : t("Write")}
          </TaskMainButton>
        </TaskActions>
      }
      headerTitle={<TaskHeaderTitle title={label} />}
    >
      <WritingQuestionScreen question={essay} />
    </TaskFrame>
  );
}

function initialMode(essay: WrittenEssay, results: EssayDraft[]): Mode {
  if (essay.draft?.text.trim()) {
    return "question";
  }

  return results.length > 0 ? "result" : "question";
}

/** A written question of an exam: read it, write it, read the grade, rewrite. */
export function WritingScreen({
  actions,
  essay,
  hrefs,
}: {
  actions: WritingActions;
  essay: WrittenEssay;
  hrefs: { exit: string };
}) {
  const [results, setResults] = useState(essay.drafts);
  const [mode, setMode] = useState<Mode>(() => initialMode(essay, results));
  const [rewriting, setRewriting] = useState(false);
  const draft = useWritingDraft({ actions, essay });
  const latest = results[0];
  const closed = essay.status === "completed" || essay.status === "skipped";

  async function rewrite() {
    if (!latest) {
      return;
    }

    setRewriting(true);
    const started = await actions.start({ previousAttemptId: latest.attemptId }).catch(() => null);
    setRewriting(false);

    if (started?.status === "ready") {
      draft.restart({ admissionId: started.admissionId, from: latest.text });
      setMode("write");
    } else if (started?.status === "limitReached") {
      setMode("refused");
    }
  }

  const screen = () => {
    if (mode === "refused") {
      return (
        <WritingRefused
          hrefs={hrefs}
          onContinue={actions.finish}
          task={{
            minutes: essay.pacing?.minutes ?? null,
            title: essay.writing.title,
            unit: essay.writing.unit,
          }}
        />
      );
    }

    if (mode === "result" && latest) {
      return (
        <ResultScreen
          closed={closed}
          finish={actions.finish}
          graded={latest}
          hrefs={hrefs}
          onRewrite={() => void rewrite()}
          rewriting={rewriting}
          writing={essay.writing}
        />
      );
    }

    if (mode === "write") {
      return (
        <WriteScreen
          actions={actions}
          draft={draft}
          essay={essay}
          hrefs={hrefs}
          onGraded={(graded) => {
            setResults((current) => [graded, ...current]);
            setMode("result");
          }}
          rewrite={results.length > 0}
        />
      );
    }

    return (
      <QuestionScreen draft={draft} essay={essay} hrefs={hrefs} onWrite={() => setMode("write")} />
    );
  };

  return screen();
}
