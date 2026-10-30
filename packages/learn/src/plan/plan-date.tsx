"use client";

import { getTargetDateBounds } from "@zoonk/core/plans/target-date-range";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { useFormatGoalDate } from "../_utils/iso-date";
import { UseDateButton, useNoticeDayText } from "./notice-day";
import { usePlanScreen } from "./plan-context";
import { useFullCourse } from "./plan-full-course";
import { StudyEverything } from "./study-everything";
import { usePlanChange } from "./use-plan-change";

function useDateNote() {
  const t = useExtracted();
  const formatGoalDate = useFormatGoalDate();

  return function dateNote({
    isExam,
    namedMonth,
    targetDate,
  }: {
    isExam: boolean;
    namedMonth: boolean;
    targetDate: string | null;
  }): string | null {
    if (namedMonth && targetDate) {
      return t("{month} for now. Pick the day when you know it.", {
        month: formatGoalDate({ isoDate: targetDate, namedMonth: true }),
      });
    }

    return targetDate || isExam
      ? null
      : t(
          "No deadline: you study everything at your own pace. With a deadline, your plan fits what matters most by then.",
        );
  };
}

function useFieldDate({
  namedMonth,
  targetDate,
}: {
  namedMonth: boolean;
  targetDate: string | null;
}): [string, (value: string) => void] {
  const fromPlan = namedMonth ? "" : (targetDate ?? "");
  const [value, setValue] = useState(fromPlan);
  const [shownDate, setShownDate] = useState(targetDate);

  if (shownDate !== targetDate) {
    setShownDate(targetDate);
    setValue(fromPlan);
  }

  return [value, setValue];
}

/**
 * A month the learner named stays a month until they pick its day, so the field starts empty
 * instead of showing a day they never chose.
 */
export function PlanDate() {
  const t = useExtracted();
  const inputId = useId();
  const noteId = useId();
  const { goal, plan, today } = usePlanScreen();
  const { change, failed, isPending } = usePlanChange();
  const noticeDayText = useNoticeDayText();
  const { noticeDay, targetDate, targetDateNamedMonth } = plan.schedule;
  const namedMonth = targetDateNamedMonth && targetDate !== null;
  const noteFor = useDateNote();
  const course = useFullCourse();
  const [value, setValue] = useFieldDate({ namedMonth, targetDate });

  if (goal.kind === "explain") {
    return null;
  }

  const setDate = async (date: string) => {
    const outcome = await change([{ kind: "setTargetDate", targetDate: date }]);

    if (outcome?.status === "applied") {
      setValue(date);
    }

    return outcome?.status === "applied";
  };

  const note = noteFor({ isExam: goal.kind === "exam", namedMonth, targetDate });
  const bounds = getTargetDateBounds(today);
  // A month's first day is a day of its own once the learner picks it.
  const canSave = value !== "" && (namedMonth || value !== targetDate) && value >= bounds.min;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor={inputId}>
        {goal.kind === "exam" ? t("Exam date") : t("Deadline")}
      </label>

      {note && (
        <p className="text-muted-foreground text-sm" id={noteId}>
          {note}
        </p>
      )}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();

          if (canSave) {
            void setDate(value);
          }
        }}
      >
        <Input
          aria-describedby={note ? noteId : undefined}
          className="max-w-48"
          disabled={isPending}
          id={inputId}
          max={bounds.max}
          min={bounds.min}
          onChange={(event) => setValue(event.target.value)}
          type="date"
          value={value}
        />
        {canSave && (
          <Button disabled={isPending} type="submit" variant="outline">
            {isPending ? t("Saving…") : t("Save")}
          </Button>
        )}
      </form>

      {noticeDay && (
        <div className="flex flex-col items-start gap-2 text-sm">
          <p className="text-muted-foreground">
            {noticeDayText({ ...noticeDay, document: plan.examDocument })}
          </p>
          <UseDateButton onUse={() => setDate(noticeDay.date)} />
        </div>
      )}

      {course && !course.isExam && <StudyEverything course={course} />}

      {failed && <ChangeSaveError />}
    </div>
  );
}
