"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TaskHeaderTitle } from "../_components/task-header";
import { TaskActions } from "../_components/task-layout";
import { ContentFeedbackMenu } from "../feedback/content-feedback-menu";
import { usePreloadMath } from "../rich-text/use-preload-math";
import { TaskFrame, type TaskFrameAside, TaskMainButton } from "../shell/task-frame";
import { getResumableAnswers, readAnswerDraft, writeAnswerDraft } from "./_utils/answer-draft";
import {
  CHOICE_QUESTION_TITLE_SLOT,
  type ChoiceAnswer,
  ChoiceQuestion,
  type ChoiceQuestionView,
} from "./choice-question";

const PERCENT = 100;

type QuestionsHeader = { closeHref: string; screen: string; title: string };

export type ChoiceQuestionAnswer = { answer: ChoiceAnswer; durationMs: number; itemId: string };

type UpcomingQuestions = { ended: boolean; total: number; waiting: React.ReactNode };

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
      ?.querySelector<HTMLElement>(`[data-slot="${CHOICE_QUESTION_TITLE_SLOT}"]`)
      ?.focus({ preventScroll: true });
  }, [container, itemId]);
}

export function ChoiceQuestionsRun<Question extends ChoiceQuestionView>({
  aside,
  draftKey,
  error,
  header,
  hint,
  onFinish,
  pending,
  questions,
  trueFalseLabels,
  upcoming,
}: {
  aside?: TaskFrameAside | null;
  draftKey?: string;
  error?: React.ReactNode;
  header: QuestionsHeader;
  hint?: (question: Question) => string;
  onFinish: (answers: ChoiceQuestionAnswer[]) => void;
  pending: boolean;
  questions: readonly Question[];
  trueFalseLabels: TrueFalseLabels;
  upcoming?: UpcomingQuestions | null;
}) {
  const t = useExtracted();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<ChoiceQuestionAnswer[]>([]);
  const [selected, setSelected] = useState<ChoiceAnswer | null>(null);
  const shownAt = useRef(0);
  const questionRef = useRef<HTMLDivElement>(null);
  const question = questions[index];
  const total = Math.max(questions.length, upcoming?.total ?? 0);
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

  const answer = (choice: ChoiceAnswer) => {
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

    draft.finish(next);
    onFinish(next);
  };

  const finishNow = () => {
    draft.finish(answers);
    onFinish(answers);
  };

  const current = Math.min(index + 1, total);

  return (
    <TaskFrame
      aside={aside}
      exitHref={header.closeHref}
      footer={
        (question || upcoming?.ended) && (
          <>
            {error}
            <QuestionsFooter
              canFinish={!question && Boolean(upcoming?.ended)}
              isLast={index + 1 >= total}
              onDontKnow={() => answer({ dontKnow: true })}
              onFinish={finishNow}
              onNext={() => selected && answer(selected)}
              pending={pending}
              question={question !== undefined}
              selected={selected !== null}
            />
          </>
        )
      }
      headerEnd={
        itemId && (
          <ContentFeedbackMenu
            label={t("Question options")}
            screen={header.screen}
            size="task"
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
      {!question && upcoming?.waiting}

      {question && (
        <div className="flex flex-col gap-4" ref={questionRef}>
          <div className="text-muted-foreground flex items-baseline justify-between gap-3 text-sm">
            <p className={cn("min-w-0 text-pretty", aside && "lg:hidden")}>{hint?.(question)}</p>
            <p className="ml-auto shrink-0 font-mono text-xs tabular-nums">
              {t("{current, number} of {total, number}", { current, total })}
            </p>
          </div>

          <ChoiceQuestion
            disabled={pending || Boolean(error)}
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
  canFinish,
  isLast,
  onDontKnow,
  onFinish,
  onNext,
  pending,
  question,
  selected,
}: {
  canFinish: boolean;
  isLast: boolean;
  onDontKnow: () => void;
  onFinish: () => void;
  onNext: () => void;
  pending: boolean;
  question: boolean;
  selected: boolean;
}) {
  const t = useExtracted();

  if (!question) {
    return canFinish ? (
      <TaskActions>
        <TaskMainButton onClick={onFinish}>{t("Finish with these answers")}</TaskMainButton>
      </TaskActions>
    ) : null;
  }

  return (
    <TaskActions>
      <Button
        className="shrink-0"
        disabled={pending}
        onClick={onDontKnow}
        size="xl"
        variant="outline"
      >
        {t("I don't know yet")}
      </Button>
      <TaskMainButton busy={pending} disabled={!selected} onClick={onNext}>
        {isLast ? t("Finish") : t("Next")}
      </TaskMainButton>
    </TaskActions>
  );
}
