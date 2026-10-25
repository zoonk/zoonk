"use client";

import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { FreeWeekOverNotice } from "../../_components/free-week-over";
import { usePlanScreen } from "../../plan/plan-context";
import {
  MoveDateFailure,
  PendingLabel,
  useCanMoveDate,
  useCoveredText,
  useMoveDate,
  usePlanCoverage,
} from "../../plan/plan-coverage";
import { useFullCourse, useFullCourseText } from "../../plan/plan-full-course";
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
  const coveredText = useCoveredText();
  const course = useFullCourse();
  const fullCourseText = useFullCourseText();

  return course?.on ? fullCourseText.onExam(course) : coveredText(coverage);
}

/** "9 subjects from the notice · 70 topics, all in your plan": the goal's structure in one line. */
function SyllabusWords({ syllabus }: { syllabus: SyllabusView }) {
  const { plan } = usePlanScreen();
  return useSyllabusSummaryText({ dailyMinutes: plan.schedule.dailyMinutes, syllabus });
}

/**
 * What the plan covers, said once in one honest sentence under its weights: when the learner's
 * time doesn't cover the goal by its date, what it does cover, with, for a goal that isn't an exam,
 * the one tap that moves its date to the day their time covers everything by (found when they tap
 * it, never for the page: see `useMoveDate`); otherwise the goal's structure ("9 subjects from the
 * notice · 70 topics, all in your plan"), and once that tap made it cover everything, that it does,
 * where focus goes, since the tap that had it is gone. "See topics" opens every subject and topic
 * in a sheet, the ones left out marked; what it takes to pass follows, once. Other ways to change
 * what it covers (more time a day, focus, studying everything) are in "Adjust", where the time
 * step's Find shows again.
 */
export function RevealCoverage({ syllabus }: { syllabus: SyllabusView | null }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const coverage = usePlanCoverage();
  const canMoveDate = useCanMoveDate();
  // Once the learner's move makes the plan cover everything, the sentence says so in place
  // instead of disappearing without a word.
  const [moved, setMoved] = useState(false);
  const move = useMoveDate({ onMoved: () => setMoved(true) });
  const done = useRef<HTMLParagraphElement>(null);
  const shown = hasSyllabusSection(syllabus) ? syllabus : null;
  const covered = moved && !coverage;

  useEffect(() => {
    if (covered) {
      done.current?.focus();
    }
  }, [covered]);

  if (plan.access.freeWeekOver) {
    return <FreeWeekOverNotice />;
  }

  const words = coverage ? (
    <CoveredWords coverage={coverage} />
  ) : (
    (covered && t("Done. Your plan now covers your whole goal.")) ||
    (shown && <SyllabusWords syllabus={shown} />)
  );

  if (!words) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2" data-slot="reveal-coverage">
      <p
        className="text-muted-foreground text-sm text-pretty focus-visible:outline-none"
        ref={done}
        role={covered ? "status" : undefined}
        tabIndex={covered ? -1 : undefined}
      >
        <span>{words}</span>
        {canMoveDate && (
          <>
            {" "}
            {/* aria-disabled, not disabled: the action keeps focus through a search of seconds. */}
            <button
              aria-busy={move.pending || undefined}
              aria-disabled={move.pending || undefined}
              className={INLINE_ACTION_CLASS}
              onClick={() => void move.move()}
              type="button"
            >
              <PendingLabel pending={move.pending}>
                {t("Move your date to cover everything")}
              </PendingLabel>
            </button>
          </>
        )}
        {shown && (
          <>
            <span aria-hidden="true">{" · "}</span>
            <SyllabusTopicsSheet className={INLINE_ACTION_CLASS} syllabus={shown} />
          </>
        )}
      </p>

      <MoveDateFailure move={move} />
      {shown && <PassMarks passMarks={shown.passMarks} />}
    </div>
  );
}
