"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eyebrow } from "../_components/eyebrow";
import {
  QuestionActions,
  QuestionDontKnow,
  QuestionMainAction,
} from "../_components/question-actions";
import { AnswersSaveError, type UnsentAnswers } from "../_components/save-error";
import { TaskHeaderTitle } from "../_components/task-header";
import { ContentFeedbackMenu } from "../feedback/content-feedback-menu";
import { type AnswerSender } from "../mistakes/drill/drill-types";
import { usePreloadMath } from "../rich-text/use-preload-math";
import { TaskFrame, type TaskFrameAside } from "../shell/task-frame";
import { getResumableAnswers, readAnswerDraft, writeAnswerDraft } from "./_utils/answer-draft";
import { type ChoiceAnswer, ChoiceQuestion, type ChoiceQuestionView } from "./choice-question";

const PERCENT = 100;

type QuestionsHeader = { closeHref: string; screen: string; title: string };

export type ChoiceQuestionAnswer = { answer: ChoiceAnswer; durationMs: number; itemId: string };

/**
 * The host clears the draft once the answers are graded (`clearAnswerDraft`); until then, a reload
 * goes on from the next question.
 */
function useAnswerDraft({
  answers,
  draftKey,
  onResume,
  questionIds,
  total,
}: {
  answers: readonly ChoiceQuestionAnswer[];
  draftKey: string | undefined;
  onResume: (answers: ChoiceQuestionAnswer[]) => void;
  questionIds: readonly string[];
  total: number;
}) {
  const resumed = useRef(false);

  // Read after hydration: the server never has the device's draft.
  useEffect(() => {
    if (!draftKey || resumed.current || questionIds.length === 0) {
      return;
    }

    resumed.current = true;

    const saved = getResumableAnswers({
      answers: readAnswerDraft<ChoiceQuestionAnswer>(draftKey),
      questionIds,
      total,
    });

    if (saved.length > 0) {
      onResume(saved);
    }
  }, [draftKey, onResume, questionIds, total]);

  useEffect(() => {
    if (draftKey && answers.length > 0) {
      writeAnswerDraft({ answers: [...answers], key: draftKey });
    }
  }, [answers, draftKey]);

  return {
    finish: (all: ChoiceQuestionAnswer[]) => {
      if (draftKey) {
        writeAnswerDraft({ answers: all, key: draftKey });
      }
    },
  };
}

/**
 * Focuses each new question's title, so Enter sends the pick instead of pressing the button the
 * last one was answered with.
 */
function useFocusNewQuestion({
  container,
  itemId,
}: {
  container: React.RefObject<HTMLElement | null>;
  itemId: string | null;
}) {
  const shownId = useRef(itemId);

  useEffect(() => {
    if (!itemId || itemId === shownId.current) {
      return;
    }

    shownId.current = itemId;

    container.current
      ?.querySelector<HTMLElement>("[data-slot=question-title]")
      ?.focus({ preventScroll: true });
  }, [container, itemId]);
}

export function ChoiceQuestionsRun<Question extends ChoiceQuestionView>({
  aside,
  draftKey,
  header,
  hint,
  onFinish,
  pending,
  questions,
  trueFalseLabels,
  unsent,
}: {
  aside?: TaskFrameAside | null;
  draftKey?: string;
  header: QuestionsHeader;
  hint?: (question: Question) => string;
  onFinish: (answers: ChoiceQuestionAnswer[]) => void;
  pending: boolean;
  questions: readonly Question[];
  trueFalseLabels: TrueFalseLabels;
  unsent: UnsentAnswers<ChoiceQuestionAnswer[]> | null;
}) {
  const t = useExtracted();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<ChoiceQuestionAnswer[]>([]);
  const [selected, setSelected] = useState<ChoiceAnswer | null>(null);
  const [sender, setSender] = useState<AnswerSender | null>(null);
  const shownAt = useRef(0);
  const questionRef = useRef<HTMLDivElement>(null);
  const question = questions[index];
  const total = questions.length;
  const itemId = question?.itemId ?? null;
  const questionIds = useMemo(() => questions.map((entry) => entry.itemId), [questions]);

  const resume = useCallback((saved: ChoiceQuestionAnswer[]) => {
    setAnswers(saved);
    setIndex(saved.length);
  }, []);

  const draft = useAnswerDraft({ answers, draftKey, onResume: resume, questionIds, total });
  usePreloadMath(questions);

  useEffect(() => {
    if (itemId) {
      shownAt.current = Date.now();
    }
  }, [itemId]);

  useFocusNewQuestion({ container: questionRef, itemId });

  const answer = (choice: ChoiceAnswer, by: AnswerSender) => {
    if (!question) {
      return;
    }

    const next = [
      ...answers,
      { answer: choice, durationMs: Date.now() - shownAt.current, itemId: question.itemId },
    ];

    if (index + 1 < total) {
      setAnswers(next);
      setIndex(index + 1);
      setSelected(null);
      return;
    }

    setSender(by);
    draft.finish(next);
    onFinish(next);
  };

  const current = Math.min(index + 1, total);
  const locked = pending || unsent !== null;

  return (
    <TaskFrame
      aside={aside}
      exitHref={header.closeHref}
      footer={
        question && (
          <>
            {unsent && !pending && (
              <AnswersSaveError
                failures={unsent.failures}
                onRetry={() => onFinish(unsent.answers)}
              />
            )}
            <QuestionsFooter
              isLast={index + 1 >= total}
              locked={locked}
              onDontKnow={() => answer({ dontKnow: true }, "notSure")}
              onNext={() => selected && answer(selected, "check")}
              pending={pending}
              selected={selected !== null}
              sender={sender}
            />
          </>
        )
      }
      headerEnd={
        itemId && (
          <ContentFeedbackMenu
            label={t("Question options")}
            screen={header.screen}
            target={{ contentId: itemId, contentKind: "item" }}
          />
        )
      }
      headerTitle={<TaskHeaderTitle title={header.title} />}
      progress={
        total > 0
          ? {
              label: t("Question {current, number} of {total, number}", { current, total }),
              value: (index / total) * PERCENT,
            }
          : undefined
      }
    >
      {question && (
        <div className="flex flex-col gap-4" ref={questionRef}>
          <div className="text-muted-foreground flex items-center justify-between gap-3">
            {hint && (
              <Eyebrow className={cn("min-w-0", aside && "with-aside:hidden")}>
                {hint(question)}
              </Eyebrow>
            )}
            <p className="ml-auto shrink-0 font-mono text-xs tabular-nums">
              {t("{current, number} of {total, number}", { current, total })}
            </p>
          </div>

          <ChoiceQuestion
            disabled={locked}
            onSelect={setSelected}
            question={question}
            selected={selected}
            trueFalseLabels={trueFalseLabels}
          />
        </div>
      )}
    </TaskFrame>
  );
}

function QuestionsFooter({
  isLast,
  locked,
  onDontKnow,
  onNext,
  pending,
  selected,
  sender,
}: {
  isLast: boolean;
  /** A failed send keeps its answers as they are: only its Try again sends them. */
  locked: boolean;
  onDontKnow: () => void;
  onNext: () => void;
  pending: boolean;
  selected: boolean;
  sender: AnswerSender | null;
}) {
  return (
    <QuestionActions>
      <QuestionDontKnow
        busy={pending && sender === "notSure"}
        disabled={locked}
        onPress={onDontKnow}
      />
      <QuestionMainAction
        action={isLast ? "finish" : "next"}
        busy={pending && sender === "check"}
        disabled={locked || !selected}
        onPress={onNext}
      />
    </QuestionActions>
  );
}
