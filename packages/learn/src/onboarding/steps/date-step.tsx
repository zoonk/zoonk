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

type DateStepProps = StepProps & { initialDate?: string | null };

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

export function DateStep({
  exam,
  initialDate,
  ...props
}: DateStepProps & { exam: { days: string[]; estimated: boolean } | null }) {
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

  // The browser explains a day past the bounds on Continue.
  const bounds = getTargetDateBounds(today);

  // Typing a year passes through 0002, 0020 and 0202, so the note waits for the whole year.
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
        <InputError aria-live="polite" className="min-h-5" id={noteId}>
          {tooEarly && t("Pick a date after today.")}
        </InputError>
      </div>
    </StepForm>
  );
}
