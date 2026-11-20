"use client";

import { type EssayDraft } from "@zoonk/core/exams/essays/contract";
import { settleWithin } from "@zoonk/utils/timeout";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { DetailsDrawer } from "../_components/details-drawer";
import { TaskHeaderTitle } from "../_components/task-header";
import { TaskActions, TaskAsideContent, TaskBody } from "../_components/task-layout";
import { type EssayStatus, GRADING_BOUNDS, StatusLine } from "../essay/essay-status-line";
import { TaskFrame, TaskMainButton } from "../shell/task-frame";
import { type WritingDraftState } from "./use-writing-draft";
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
  const canSend = draft.text.trim().length > 0 && status !== "pending";

  async function send() {
    setStatus("pending");
    const text = draft.text;
    const admissionId = await draft.admissionId();

    if (!admissionId) {
      setStatus("error");
      return;
    }

    await draft.flush();

    const settled = await settleWithin({
      ms: GRADING_BOUNDS.timeoutMs,
      request: () => actions.submit({ admissionId, durationMs: draft.durationMs(), text }),
    }).catch(() => null);

    const result = settled?.status === "settled" ? settled.value : null;

    if (!result) {
      setStatus("error");
      return;
    }

    setStatus("idle");
    draft.clear();
    onGraded(result);
  }

  const question = <WritingQuestionBody question={essay} />;

  return (
    <TaskFrame
      aside={{ label: t("Question"), title: essay.writing.title }}
      beforeExit={draft.pending}
      exitHref={hrefs.exit}
      fit="always"
      footer={
        <>
          <StatusLine gradesLeft={1} status={status} />
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
          text={draft.text}
          writing={essay.writing}
        />
      </TaskBody>
    </TaskFrame>
  );
}
