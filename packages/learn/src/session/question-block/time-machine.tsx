"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { HistoryIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useTrueFalseLabels } from "../../questions/use-true-false-labels";
import { type StudyQuestion } from "../session-types";

type TimeMachineView = NonNullable<StudyQuestion["timeMachine"]>;

/** How today's answer went, or null before it. */
type AnswerResult = "correct" | "wrong" | null;

/** A quoted answer ends at its quote mark, so a period of its own would double the sentence's. */
function trimEndPeriod(text: string): string {
  return text.replace(/\.+$/u, "");
}

/**
 * What the line says. Before the answer: only when the learner saw the question, since their
 * earlier answer could give today's away. After it: the earlier answer, quoted, when it was wrong.
 * A statement's past answer is saved as "true" or "false" and reads in the exam's words.
 */
function useTimeMachineText({
  format,
  trueFalseLabels,
}: {
  format: StudyQuestion["format"];
  trueFalseLabels: TrueFalseLabels;
}) {
  const t = useExtracted();
  const formatter = useFormatter();
  const { answerText } = useTrueFalseLabels(trueFalseLabels);

  return ({ machine, result }: { machine: TimeMachineView; result: AnswerResult }): string => {
    const date = formatter.dateTime(machine.answeredAt, { day: "numeric", month: "long" });

    if (!result) {
      return t("You saw this on {date}.", { date });
    }

    if (machine.isCorrect) {
      return result === "correct"
        ? t("Right again, like on {date}.", { date })
        : t("On {date} you got this one right.", { date });
    }

    const answer = format === "trueFalse" ? answerText(machine.answer) : machine.answer;

    return answer
      ? t("On {date} you answered “{answer}”.", { answer: trimEndPeriod(answer), date })
      : t("On {date} this one tripped you up.", { date });
  };
}

/**
 * When the learner last met a capsule question, in one quiet line: when, before they answer, and
 * how far they've come, after.
 */
export function TimeMachine({
  format,
  machine,
  result,
  trueFalseLabels,
}: {
  format: StudyQuestion["format"];
  machine: TimeMachineView;
  result: AnswerResult;
  trueFalseLabels: TrueFalseLabels;
}) {
  const text = useTimeMachineText({ format, trueFalseLabels })({ machine, result });

  return (
    <p className="text-muted-foreground flex items-start gap-2 text-sm" aria-live="polite">
      <LineMarker>
        <HistoryIcon aria-hidden="true" className="size-4" />
      </LineMarker>
      {text}
    </p>
  );
}
