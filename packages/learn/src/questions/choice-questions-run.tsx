"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button } from "@zoonk/ui/components/button";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearAnswerDraft,
  getResumableAnswers,
  readAnswerDraft,
  writeAnswerDraft,
} from "./_utils/answer-draft";
import { type ChoiceAnswer, ChoiceQuestion, type ChoiceQuestionView } from "./choice-question";
import { QuestionsHeader } from "./questions-header";

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
 * question instead of starting over; the draft goes once the run is finished and left.
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
  const finished = useRef(false);
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

  useEffect(
    () => () => {
      if (draftKey && finished.current) {
        clearAnswerDraft(draftKey);
      }
    },
    [draftKey],
  );

  return {
    /** The last answer is in: the draft holds them all until the run is left. */
    finish: (all: ChoiceQuestionAnswer[]) => {
      finished.current = true;

      if (draftKey) {
        writeAnswerDraft({ answers: all, key: draftKey });
      }
    },
  };
}

/**
 * Questions asked one per screen, full screen like every task: no feedback until the end, "I
 * don't know yet" always allowed, and Enter for Next once an option is picked. The test's header
 * (`header`) shows how far in, a quiet line sits above each question (`hint`), and the host gets
 * every answer once the last one is in (`onFinish`); `pending` holds the buttons while it grades
 * them. Questions can arrive while the first ones are asked (`upcoming`): they're added at the
 * end of `questions`, and the run waits for them after the last one it has. With `draftKey`, each
 * answer is kept on the device as it's given, so a reload goes on where the learner was.
 */
export function ChoiceQuestionsRun<Question extends ChoiceQuestionView>({
  draftKey,
  header,
  hint,
  onFinish,
  pending,
  questions,
  trueFalseLabels,
  upcoming,
}: {
  /** Where this run's answers are kept on the device until it's finished; none to keep them. */
  draftKey?: string;
  header: Pick<React.ComponentProps<typeof QuestionsHeader>, "closeHref" | "screen" | "title">;
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
  const question = questions[index];
  const total = Math.max(questions.length, upcoming?.total ?? 0);
  const itemId = question?.itemId ?? null;
  const questionIds = useMemo(() => questions.map((entry) => entry.itemId), [questions]);

  const resume = useCallback((saved: ChoiceQuestionAnswer[]) => {
    setAnswers(saved);
    setIndex(saved.length);
  }, []);

  const draft = useAnswerDraft({ answers, draftKey, onResume: resume, questionIds, total });

  // Each answer is timed from when its question showed, even one that arrived while the learner
  // waited for it.
  useEffect(() => {
    if (itemId) {
      shownAt.current = Date.now();
    }
  }, [itemId]);

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

  const nextRef = useEnterClick<HTMLButtonElement>({
    enabled: question !== undefined && selected !== null && !pending,
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <QuestionsHeader {...header} index={index} itemId={itemId} total={total} />

      {!question && upcoming && (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-6">
          {upcoming.waiting}

          {upcoming.ended && (
            <Button
              onClick={() => {
                draft.finish(answers);
                onFinish(answers);
              }}
              size="lg"
            >
              {t("Finish with these answers")}
            </Button>
          )}
        </div>
      )}

      {question && (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
          {hint && <p className="text-muted-foreground text-sm">{hint(question)}</p>}

          <ChoiceQuestion
            onSelect={setSelected}
            question={question}
            selected={selected}
            trueFalseLabels={trueFalseLabels}
          />

          <div className="mt-auto flex flex-col gap-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row-reverse">
            <Button
              disabled={!selected || pending}
              onClick={() => selected && answer(selected)}
              ref={nextRef}
              size="lg"
            >
              {index + 1 < total ? t("Next") : t("Finish")}
            </Button>
            <Button
              disabled={pending}
              onClick={() => answer({ dontKnow: true })}
              size="lg"
              variant="ghost"
            >
              {t("I don't know yet")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
