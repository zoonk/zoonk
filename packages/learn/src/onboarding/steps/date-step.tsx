"use client";

import { getTargetDateBounds } from "@zoonk/core/plans/target-date-range";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { Input, InputError } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { toLocalIsoDate, useFormatIsoDate } from "../../_utils/iso-date";
import { useKeptTyping } from "../../use-kept-typing";
import { StepForm } from "./step-form";

type StepProps = {
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  subject: string;
};

type DateStepProps = StepProps & {
  /**
   * The goal's date so far ("YYYY-MM-DD"), such as an exam course's next sitting set when it
   * started: the field opens on it, so Continue keeps it, and it can still be changed or removed.
   */
  initialDate?: string | null;
};

/**
 * An exam course's date question leads with the exam's own days ("Your exam is on Nov 8 (and Nov
 * 15)"): Continue plans for its first day, and another date (or none) is the second path.
 */
function ExamDateStep({
  exam,
  onAnswer,
  onOtherDate,
  pending,
  subject,
}: StepProps & { exam: { days: string[]; estimated: boolean }; onOtherDate: () => void }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const [first = "", second] = exam.days;
  const date = formatDate(first);

  const ready =
    second === undefined
      ? t("Your plan gets you ready by then.")
      : t("Your plan gets you ready by the first day.");

  return (
    <StepForm
      description={
        exam.estimated
          ? `${ready} ${t("This is the expected date until the notice confirms it.")}`
          : ready
      }
      onContinue={() => onAnswer({ question: "targetDate", targetDate: first })}
      onSkip={onOtherDate}
      pending={pending}
      skipLabel={t("Another date")}
      subject={subject}
      title={
        second === undefined
          ? t("Your exam is on {date}", { date })
          : t("Your exam is on {date} (and {second})", { date, second: formatDate(second) })
      }
    />
  );
}

/**
 * A deadline is optional: without one, the learner studies everything at their own pace and the
 * plan shows when each milestone arrives. An exam course's sitting leads instead, with this as
 * its other path (see `ExamDateStep`).
 */
export function DateStep({
  exam,
  initialDate,
  ...props
}: DateStepProps & {
  /** The exam course's next sitting the goal started from; null for other goals. */
  exam: { days: string[]; estimated: boolean } | null;
}) {
  const [otherDate, setOtherDate] = useState(
    () => !exam || (Boolean(initialDate) && initialDate !== exam.days[0]),
  );

  if (exam && !otherDate) {
    return <ExamDateStep {...props} exam={exam} onOtherDate={() => setOtherDate(true)} />;
  }

  return <DateFieldStep {...props} initialDate={initialDate} />;
}

function DateFieldStep({ initialDate, onAnswer, pending, subject }: DateStepProps) {
  const t = useExtracted();
  const inputId = useId();
  const noteId = useId();
  const [date, setDate] = useState(initialDate ?? "");
  const kept = useKeptTyping(setDate);
  const mountedAt = useMountTime();
  const today = toLocalIsoDate(mountedAt);

  // After today, and no later than a plan reaches: the browser explains a day past it on Continue.
  const bounds = getTargetDateBounds(today);

  // A typed date the picker would have greyed out says why Continue waits. Typing a year passes
  // through 0002, 0020 and 0202 on its way to 2026, so the note waits for the whole year.
  const tooEarly = date !== "" && date <= today && !date.startsWith("0");

  return (
    <StepForm
      canContinue={date > today}
      description={t(
        "Without a date, you study everything at your own pace, and we show when you reach each milestone.",
      )}
      onContinue={() => onAnswer({ question: "targetDate", targetDate: date })}
      onSkip={() => onAnswer({ question: "targetDate", targetDate: null })}
      pending={pending}
      skipLabel={t("No date, study everything")}
      subject={subject}
      title={t("Is there a date you're aiming for?")}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>{t("Date")}</Label>
        <Input
          aria-describedby={noteId}
          className="h-11 text-base md:text-[0.9375rem]"
          id={inputId}
          {...kept.field}
          max={bounds.max}
          min={bounds.min}
          onChange={(event) => setDate(event.target.value)}
          type="date"
          value={date}
        />
        {/* The note's line stays while it's empty, so it never moves Continue. */}
        <InputError aria-live="polite" className="min-h-5" id={noteId}>
          {tooEarly && t("Pick a date after today.")}
        </InputError>
      </div>
    </StepForm>
  );
}
