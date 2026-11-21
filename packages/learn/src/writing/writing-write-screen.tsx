"use client";

import { type EssayDraft, MAX_ESSAY_CHARACTERS } from "@zoonk/core/exams/essays/contract";
import { settleWithin } from "@zoonk/utils/timeout";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { DetailsDrawer } from "../_components/details-drawer";
import { TaskHeaderTitle } from "../_components/task-header";
import { TaskActions, TaskAsideContent, TaskBody } from "../_components/task-layout";
import { type EssayStatus, GRADING_BOUNDS, StatusLine } from "../essay/essay-status-line";
import { TaskFrame, TaskMainButton } from "../shell/task-frame";
import { type WritingDraftState } from "./use-writing-draft";
import { WritingConflictDialog } from "./writing-conflict-dialog";
import { WritingEditor } from "./writing-editor";
import { useHeaderLabel } from "./writing-header";
import { WritingCriteriaSection, WritingQuestionBody } from "./writing-question";
import { type WritingActions, type WrittenEssay } from "./writing-types";

/** The field fills the screen; the question is one tap away on a phone and beside it on a computer. */
export function WriteScreen({
  actions,
  draft,
  essay,
  hrefs,
  onGraded,
  rewrite,
}: {
  actions: WritingActions;
  draft: WritingDraftState;
  essay: WrittenEssay;
  hrefs: { exit: string };
  onGraded: (graded: EssayDraft) => void;
  rewrite: boolean;
}) {
  const t = useExtracted();
  const [status, setStatus] = useState<EssayStatus>("idle");
  const label = useHeaderLabel(essay.writing);
  const fits = draft.text.length <= MAX_ESSAY_CHARACTERS;
  const canSend = draft.text.trim().length > 0 && fits && status !== "pending";

  const fail = () => {
    draft.lock(false);
    setStatus("error");
  };

  // From the tap until grading fails or the result opens, the field is read-only: what's graded
  // is what's on screen.
  async function send() {
    setStatus("pending");
    draft.lock(true);
    const text = draft.text;
    const admissionId = await draft.admissionId();

    if (!admissionId) {
      fail();
      return;
    }

    await draft.flush();

    if (draft.conflicted()) {
      draft.lock(false);
      setStatus("idle");
      return;
    }

    const settled = await settleWithin({
      ms: GRADING_BOUNDS.timeoutMs,
      request: () => actions.submit({ admissionId, durationMs: draft.durationMs(), text }),
    }).catch(() => null);

    const result = settled?.status === "settled" ? settled.value : null;

    if (!result) {
      fail();
      return;
    }

    setStatus("idle");

    // A send whose answer was lost was graded as first sent: what's on screen now stays kept.
    if (result.text === text) {
      draft.clear();
    }

    onGraded(result);
  }

  const question = <WritingQuestionBody question={essay} />;

  return (
    <TaskFrame
      aside={{ label: t("Question"), title: essay.writing.title }}
      beforeExit={() => draft.flush()}
      confirmExit={
        draft.saveFailed
          ? {
              cancel: t("Keep writing"),
              confirm: t("Leave"),
              description: t("It's kept on this device and saves when you're back online."),
              title: t("Your answer isn't saved yet"),
            }
          : null
      }
      exitHref={hrefs.exit}
      fit="always"
      footer={
        <>
          <StatusLine saveFailed={draft.saveFailed} status={status} />
          <TaskActions>
            <TaskMainButton
              busy={status === "pending"}
              disabled={!canSend}
              onClick={() => void send()}
            >
              {rewrite ? t("Grade rewrite") : t("Grade answer")}
            </TaskMainButton>
          </TaskActions>
        </>
      }
      headerEnd={
        <span className="flex lg:hidden">
          <DetailsDrawer label={t("Question")} title={essay.writing.title} trigger="bar">
            <div className="flex flex-col gap-8">
              {question}
              <WritingCriteriaSection writing={essay.writing} />
            </div>
          </DetailsDrawer>
        </span>
      }
      headerTitle={<TaskHeaderTitle title={label} />}
    >
      <TaskBody className="min-h-0 pb-4">
        <TaskAsideContent className="flex flex-col gap-6 max-lg:hidden">
          {question}
          <WritingCriteriaSection writing={essay.writing} />
        </TaskAsideContent>
        <WritingEditor
          label={rewrite ? t("Rewrite what needs work") : t("Your answer")}
          onChange={draft.write}
          readOnly={status === "pending"}
          text={draft.text}
          writing={essay.writing}
        />
      </TaskBody>
      <WritingConflictDialog draft={draft} />
    </TaskFrame>
  );
}
