"use client";

import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { FreeWeekOverNotice } from "../../_components/free-week-over";
import { useFormatDuration } from "../../_utils/time-format";
import { usePlanScreen } from "../../plan/plan-context";
import { useCoveredText, usePlanCoverage } from "../../plan/plan-coverage";
import { PlanFailedMessage } from "../../plan/plan-failed-message";
import { useFullCourse, useFullCourseText } from "../../plan/plan-full-course";
import { usePlanChange } from "../../plan/use-plan-change";
import { PassMarks } from "../../syllabus/syllabus-notes";
import { hasSyllabusSection } from "../../syllabus/syllabus-section";
import { SyllabusTopicsSheet, useSyllabusSummaryText } from "../../syllabus/syllabus-summary";
import { INLINE_ACTION_CLASS } from "./step-parts";

type Coverage = NonNullable<ReturnType<typeof usePlanCoverage>>;

/**
 * What the learner's time covers when it doesn't cover the whole goal by its date, or, while an
 * exam's plan studies everything, when it ends.
 */
function CoveredWords({ coverage }: { coverage: Coverage }) {
  const t = useExtracted();
  const coveredText = useCoveredText();
  const course = useFullCourse();
  const fullCourseText = useFullCourseText();

  if (course?.on) {
    return `${fullCourseText.finish(course)} ${t("Until the exam, what comes up most comes first.")}`;
  }

  return coveredText(coverage);
}

/** "9 subjects from the notice · 70 topics, all in your plan": the goal's structure in one line. */
function SyllabusWords({ syllabus }: { syllabus: SyllabusView }) {
  const { plan } = usePlanScreen();
  return useSyllabusSummaryText({ dailyMinutes: plan.schedule.dailyMinutes, syllabus });
}

/**
 * The one tap a plan that doesn't cover its goal offers, as words of its sentence: the daily time
 * that covers more ("Use 1h 40 a day"), or, when no daily time covers a goal that isn't an exam by
 * its date, the date that does. The plan re-plans from today and shows it.
 */
function CoverageSwitch({
  coverage,
  disabled,
  onSwitch,
}: {
  coverage: Coverage;
  disabled: boolean;
  onSwitch: () => void;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { fittingDate, target } = coverage;

  if (!fittingDate && !target) {
    return null;
  }

  return (
    <button className={INLINE_ACTION_CLASS} disabled={disabled} onClick={onSwitch} type="button">
      {fittingDate
        ? t("Move your date to cover everything")
        : t("Use {time} a day", { time: formatDuration(target?.dailyMinutes ?? 0) })}
    </button>
  );
}

/**
 * What the plan covers, said once in one honest sentence under its weights: when the learner's
 * time doesn't cover the goal by its date, what it does cover, with the one tap that covers more
 * ("Use 1h 40 a day"); otherwise the goal's structure ("9 subjects from the notice · 70 topics,
 * all in your plan"), and once that tap made it cover everything, that it does. "See topics" opens
 * every subject and topic in a sheet, the ones left out marked; what it takes to pass follows,
 * once. Other ways to change what it covers (focus, studying everything) are in "Adjust".
 */
export function RevealCoverage({ syllabus }: { syllabus: SyllabusView | null }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const coverage = usePlanCoverage();
  const { change, failed, isPending } = usePlanChange();
  // Once the learner's switch makes the plan cover everything, the sentence says so in place
  // instead of disappearing without a word.
  const [switched, setSwitched] = useState(false);
  const shown = hasSyllabusSection(syllabus) ? syllabus : null;

  if (plan.access.freeWeekOver) {
    return <FreeWeekOverNotice />;
  }

  const switchPlan = (target: Coverage) =>
    void change(
      [
        target.fittingDate
          ? { kind: "setTargetDate", targetDate: target.fittingDate }
          : { kind: "setDailyMinutes", minutes: target.target?.dailyMinutes ?? 0 },
      ],
      (outcome) => setSwitched(outcome?.status === "applied"),
    );

  const words = coverage ? (
    <CoveredWords coverage={coverage} />
  ) : (
    (switched && t("Done. Your plan now covers your whole goal.")) ||
    (shown && <SyllabusWords syllabus={shown} />)
  );

  if (!words) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2" data-slot="reveal-coverage">
      <p
        className="text-muted-foreground text-sm text-pretty"
        role={switched && !coverage ? "status" : undefined}
      >
        <span>{words}</span>
        {coverage && (
          <>
            {" "}
            <CoverageSwitch
              coverage={coverage}
              disabled={isPending}
              onSwitch={() => switchPlan(coverage)}
            />
          </>
        )}
        {shown && (
          <>
            <span aria-hidden="true">{" · "}</span>
            <SyllabusTopicsSheet className={INLINE_ACTION_CLASS} syllabus={shown} />
          </>
        )}
      </p>

      {failed && <PlanFailedMessage />}
      {shown && <PassMarks passMarks={shown.passMarks} />}
    </div>
  );
}
