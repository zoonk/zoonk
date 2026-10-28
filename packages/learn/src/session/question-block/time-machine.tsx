"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { HistoryIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { Callout } from "../../_components/callout";
import { FeedbackNote } from "../../_components/feedback-panel";
import { toPlainItemLine } from "../../questions/_utils/item-text";
import { useTrueFalseLabels } from "../../questions/use-true-false-labels";
import { type StudyQuestion } from "../session-types";

type TimeMachineView = NonNullable<StudyQuestion["timeMachine"]>;

type AnswerResult = "correct" | "wrong" | null;

/** A quoted answer ends at its quote mark, so a period of its own would double the sentence's. */
function trimEndPeriod(text: string): string {
  return text.replace(/\.+$/u, "");
}

/** Before the answer, only that the learner saw the question: their earlier answer could give today's away. */
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
        : t("You got it right on {date}. Reviewing it now helps it stick.", { date });
    }

    const answer =
      format === "trueFalse" ? answerText(machine.answer) : toPlainItemLine(machine.answer ?? "");

    return answer
      ? t("On {date} you answered “{answer}”.", { answer: trimEndPeriod(answer), date })
      : t("On {date} this one tripped you up.", { date });
  };
}

export function TimeMachine({
  format,
  machine,
  trueFalseLabels,
}: {
  format: StudyQuestion["format"];
  machine: TimeMachineView;
  trueFalseLabels: TrueFalseLabels;
}) {
  const text = useTimeMachineText({ format, trueFalseLabels })({ machine, result: null });

  return (
    <Callout>
      <HistoryIcon aria-hidden="true" />
      <p>{text}</p>
    </Callout>
  );
}

export function TimeMachineNote({
  format,
  machine,
  result,
  trueFalseLabels,
}: {
  format: StudyQuestion["format"];
  machine: TimeMachineView;
  result: Exclude<AnswerResult, null>;
  trueFalseLabels: TrueFalseLabels;
}) {
  const text = useTimeMachineText({ format, trueFalseLabels })({ machine, result });
  return <FeedbackNote>{text}</FeedbackNote>;
}
