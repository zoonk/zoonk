"use client";

import { getTargetDateBounds } from "@zoonk/core/plans/target-date-range";
import { type NoSitting } from "@zoonk/core/plans/view-contract";
import {
  type OnboardingAnswerInput,
  type OnboardingDateProblem,
} from "@zoonk/core/view-models/onboarding/contract";
import { Input, InputError } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { useFormatIsoDate } from "../../_utils/iso-date";
import { NoSittingWords } from "../../plan/notice-day";
import { useKeptTyping } from "../../use-kept-typing";
import { StepForm } from "./step-form";

type StepProps = {
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  subject: string;
};

type DateStepProps = StepProps & { passedNote: string | null };

function ExamDateStep({
  exam,
  onAnswer,
  onOtherDate,
  passedNote,
  pending,
  subject,
}: DateStepProps & { exam: { days: string[]; estimated: boolean }; onOtherDate: () => void }) {
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
      description={[
        passedNote,
        ready,
        exam.estimated && t("This is the expected date until the notice confirms it."),
      ]
        .filter(Boolean)
        .join(" ")}
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

/** Core counts the goal's days in its zone, UTC without one, so the date screen does too. */
function getGoalToday({ now, timeZone }: { now: Date; timeZone: string | null }): string {
  const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";

  return getDateInTimeZone({ date: now, timeZone: zone })
    .toISOString()
    .slice(0, "YYYY-MM-DD".length);
}

/** A date that has passed, or is today, is said so and never kept as the learner's answer. */
export function DateStep({
  dateProblem,
  exam,
  initialDate,
  timeZone,
  ...props
}: StepProps & {
  dateProblem: OnboardingDateProblem | null;
  exam: { days: string[]; estimated: boolean } | null;
  initialDate: string | null;
  timeZone: string | null;
}) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const today = getGoalToday({ now: useMountTime(), timeZone });
  const gone = dateProblem?.kind === "passed" || dateProblem?.kind === "today";
  const kept = gone ? null : initialDate;

  const passedNote =
    gone && initialDate
      ? t(
          "{when, select, today {Your date is today, so there are no days left to plan.} other {Your date, {date}, has passed.}}",
          { date: formatDate(initialDate, "long"), when: dateProblem.kind },
        )
      : null;

  const [otherDate, setOtherDate] = useState(
    () => !exam || (kept !== null && kept !== exam.days[0]),
  );

  if (exam && !otherDate) {
    return (
      <ExamDateStep
        {...props}
        exam={exam}
        onOtherDate={() => setOtherDate(true)}
        passedNote={passedNote}
      />
    );
  }

  return (
    <DateFieldStep
      {...props}
      initialDate={kept}
      noSitting={dateProblem?.kind === "noSitting" ? dateProblem : null}
      passedNote={passedNote}
      today={today}
    />
  );
}

const MONTH_LENGTH = "YYYY-MM".length;

function DateFieldStep({
  initialDate,
  noSitting,
  onAnswer,
  passedNote,
  pending,
  subject,
  today,
}: DateStepProps & { initialDate: string | null; noSitting: NoSitting | null; today: string }) {
  const t = useExtracted();
  const inputId = useId();
  const noteId = useId();
  const [date, setDate] = useState(initialDate ?? "");
  const kept = useKeptTyping(setDate);

  // The browser explains a day past the bounds on Continue.
  const bounds = getTargetDateBounds(today);

  // Typing a year passes through 0002, 0020 and 0202, so the note waits for the whole year.
  const tooEarly = date !== "" && date <= today && !date.startsWith("0");

  const noSittingShown =
    noSitting && date.slice(0, MONTH_LENGTH) === noSitting.month.slice(0, MONTH_LENGTH)
      ? noSitting
      : null;

  const withoutDate = t(
    "Without a date, you study everything at your own pace, and we show when you reach each milestone.",
  );

  return (
    <StepForm
      canContinue={date > today}
      description={[passedNote, withoutDate].filter(Boolean).join(" ")}
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

        {noSittingShown && (
          <p className="text-muted-foreground text-sm text-pretty" data-slot="no-sitting">
            <NoSittingWords
              disabled={pending}
              noSitting={noSittingShown}
              onUse={(targetDate) => onAnswer({ question: "targetDate", targetDate })}
            />
          </p>
        )}
      </div>
    </StepForm>
  );
}
