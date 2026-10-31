"use client";

import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { FreeWeekOverNotice } from "../../_components/free-week-over";
import { usePlanScreen } from "../../plan/plan-context";
import {
  MoveDateFailure,
  MoveDateLabel,
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

type Coverage = NonNullable<ReturnType<typeof usePlanCoverage>>;

function CoveredWords({ coverage }: { coverage: Coverage }) {
  const coveredText = useCoveredText();
  const course = useFullCourse();
  const fullCourseText = useFullCourseText();

  return course?.on ? fullCourseText.onExam(course) : coveredText(coverage);
}

function SyllabusWords({ syllabus }: { syllabus: SyllabusView }) {
  const { plan } = usePlanScreen();
  return useSyllabusSummaryText({ dailyMinutes: plan.schedule.dailyMinutes, syllabus });
}

export function RevealCoverage({ syllabus }: { syllabus: SyllabusView | null }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const coverage = usePlanCoverage();
  const canMoveDate = useCanMoveDate();
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
            {/* Focusable while disabled: the action keeps focus through a search of seconds. */}
            <Button
              aria-busy={move.pending || undefined}
              disabled={move.pending}
              focusableWhenDisabled
              onClick={() => void move.move()}
              variant="link"
            >
              <PendingLabel pending={move.pending}>
                <MoveDateLabel move={move} />
              </PendingLabel>
            </Button>
          </>
        )}
        {shown && (
          <>
            <span aria-hidden="true">{" · "}</span>
            <SyllabusTopicsSheet syllabus={shown} />
          </>
        )}
      </p>

      <MoveDateFailure move={move} />
      {shown && <PassMarks passMarks={shown.passMarks} />}
    </div>
  );
}
