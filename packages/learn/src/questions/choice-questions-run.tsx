"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TaskHeaderTitle } from "../_components/task-header";
import { TaskActions } from "../_components/task-layout";
import { ContentVoteMenu } from "../feedback/content-vote-menu";
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

/** The run's header: where closing goes, the screen a report names, and the test's title. */
type QuestionsHeader = { closeHref: string; screen: string; title: string };

/** One answer of a run of questions, with how long the learner took on it. */
export type ChoiceQuestionAnswer = { answer: ChoiceAnswer; durationMs: number; itemId: string };

/** Questions still being written while the first ones are asked. */
export type UpcomingQuestions = {
  /** The writing stopped short of `total`: the learner can finish with the answers so far. */
  ended: boolean;
  /** How many questions the run asks in all, the ones still being written included. */
  total: number;
  /** Shown in place of the next question once every question so far is answered, until it comes. */
  waiting: React.ReactNode;
};

/**
 * Keeps each answer on the device as it's given (`draftKey`), so a reload goes on from the next
 * question instead of starting over. The host clears it once the answers are graded
 * (`clearAnswerDraft`): answers whose grade didn't go through stay on the device, so leaving and
 * coming back still has them.
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
    /** The last answer is in: the draft holds them all until the host clears it. */
    finish: (all: ChoiceQuestionAnswer[]) => {
      if (draftKey) {
        writeAnswerDraft({ answers: all, key: draftKey });
      }
    },
  };
}

/**
 * A new question takes the focus, on its title: a screen reader reads it, and Enter sends the
 * answer picked instead of pressing the button the last question was answered with ("I don't know
 * yet" kept the focus, so Enter sent that for every later answer). The first question keeps the
 * focus where the browser put it.
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

/**
 * Questions asked one per screen, full screen like every task: no feedback until the end, "I
 * don't know yet" always allowed beside Next in the pinned action bar, and Enter for Next once an
 * option is picked. The task's header (`header`) has the question's "…" menu to report a problem
 * and one bar for how far in; a quiet line sits above each question (`hint`) with its number in the
 * mono face, and the host gets
 * every answer once the last one is in (`onFinish`); `pending` holds the buttons while it grades
 * them, and a grade that didn't go through says so over them (`error`), the last question still on
 * screen and locked. Questions can arrive while the first ones are asked (`upcoming`): they're
 * added at the end of `questions`, and the run waits for them after the last one it has. With
 * `draftKey`, each answer is kept on the device as it's given, so a reload goes on where the
 * learner was, until the host clears it once the answers are graded.
 */
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
  /**
   * What helps beside the questions from `lg` (a test-out's rule and what passing skips); the hint
   * line is then the phone's, since the aside says it on a wide screen.
   */
  aside?: TaskFrameAside | null;
  /** Where this run's answers are kept on the device until it's finished; none to keep them. */
  draftKey?: string;
  /** Over the actions: the answers couldn't be graded, with a way to send them again. */
  error?: React.ReactNode;
  header: QuestionsHeader;
  /** The line above a question: a rule of the test, or what the question is about. */
  hint?: (question: Question) => string;
  onFinish: (answers: ChoiceQuestionAnswer[]) => void;
  pending: boolean;
  questions: readonly Question[];
  /** The words the goal's true-or-false questions are answered with, by its exam. */
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

  // Each answer is timed from when its question showed, even one that arrived while the learner
  // waited for it.
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
          <ContentVoteMenu
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

          {/* The answer being graded, or waiting to be sent again, stays the one on screen. */}
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

/**
 * The run's pinned action bar: "I don't know yet" beside Next (Finish on the last question, with a
 * spinner while the answers are graded), or, while waiting for questions that stopped coming,
 * finishing with the answers given.
 */
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
