"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { HistoryIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useExperienceMode } from "../../mode-provider";
import { useTrueFalseLabels } from "../../questions/use-true-false-labels";
import { type StudyQuestion } from "../session-types";

type TimeMachineView = NonNullable<StudyQuestion["timeMachine"]>;

/** A statement's past answer is saved as "true" or "false": it reads in the exam's words. */
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

  return (machine: TimeMachineView): string => {
    const date = formatter.dateTime(machine.answeredAt, { day: "numeric", month: "short" });
    const answer = format === "trueFalse" ? answerText(machine.answer) : machine.answer;

    if (answer) {
      return t("On {date} you answered {answer}. What about now?", { answer, date });
    }

    return machine.isCorrect
      ? t("On {date} you got this one right. Still sure?", { date })
      : t("On {date} this one tripped you up. What about now?", { date });
  };
}

/**
 * The learner's own past answer on a capsule question, so they can see how far they've come. Fun
 * gives it the time machine card; Focus keeps it to one quiet line.
 */
export function TimeMachine({
  format,
  machine,
  trueFalseLabels,
}: {
  format: StudyQuestion["format"];
  machine: TimeMachineView;
  trueFalseLabels: TrueFalseLabels;
}) {
  const t = useExtracted();
  const mode = useExperienceMode();
  const text = useTimeMachineText({ format, trueFalseLabels })(machine);

  if (mode !== "fun") {
    return (
      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <LineMarker>
          <HistoryIcon aria-hidden="true" className="size-4" />
        </LineMarker>
        {text}
      </p>
    );
  }

  return (
    <div className="fun-glass flex items-start gap-3 rounded-3xl p-4">
      <span className="bg-fun-soft text-fun-accent-cyan flex size-10 shrink-0 items-center justify-center rounded-full">
        <HistoryIcon aria-hidden="true" className="size-5" />
      </span>
      <div className="flex flex-col gap-0.5">
        <p className="text-fun-accent-cyan text-xs font-bold tracking-[0.16em] uppercase">
          {t("Time machine")}
        </p>
        <p className="text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
