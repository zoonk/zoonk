"use client";

import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted, useFormatter } from "next-intl";
import { Fragment, useEffect, useRef, useState } from "react";
import { FreeWeekOverNotice } from "../../_components/free-week-over";
import { useGoalDateValues } from "../../_utils/iso-date";
import { useSentenceSpace } from "../../_utils/locale";
import { useFormatDuration } from "../../_utils/time-format";
import { LearnLink } from "../../learn-link";
import { usePlanScreen } from "../../plan/plan-context";
import {
  MoveDateFailure,
  MoveDateLabel,
  useCanMoveDate,
  useCoveredText,
  useMoveDate,
  usePlanCoverage,
} from "../../plan/plan-coverage";
import { useCanChooseFocus, useChooseFocus } from "../../plan/plan-focus";
import { useCheckFocusLabel, useFocusTestOffer } from "../../plan/plan-focus-test";
import { useFullCourse, useFullCourseText } from "../../plan/plan-full-course";
import { PassMarks } from "../../syllabus/syllabus-notes";
import { hasSyllabusSection } from "../../syllabus/syllabus-section";
import { SyllabusTopicsSheet, useSyllabusSummaryText } from "../../syllabus/syllabus-summary";

type Coverage = NonNullable<ReturnType<typeof usePlanCoverage>>;

const LINKS_CLASS = "flex flex-wrap gap-x-4 gap-y-1 text-sm";

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

/** What a short plan trades: null unless the time doesn't cover everything and the plan has a focus. */
function useFocusTradeOff(): string | null {
  const t = useExtracted();
  const format = useFormatter();
  const formatDuration = useFormatDuration();
  const goalDate = useGoalDateValues();
  const coverage = usePlanCoverage();
  const { plan } = usePlanScreen();
  const { dailyMinutes, targetDate, targetDateNamedMonth } = plan.schedule;

  const focused = plan.areas
    .filter((area) => area.focused && !area.partOf)
    .map((area) => area.name);

  if (!coverage || !targetDate || focused.length === 0) {
    return null;
  }

  return t({
    description:
      'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5". {time} is a daily study time, like "4 hr"; {areas} lists up to three exam subjects.',
    message:
      "{dateKind, select, month {At {time} a day, some topics won't fit before {date}. This plan gives {areas} more time.} other {At {time} a day, some topics won't fit before {date}. This plan gives {areas} more time.}}",
    values: {
      ...goalDate({ isoDate: targetDate, namedMonth: targetDateNamedMonth, style: "long" }),
      areas: format.list(focused, { type: "conjunction" }),
      time: formatDuration(dailyMinutes),
    },
  });
}

/** The focus the plan follows, with what it leaves out, how to change it and where it came from. */
function FocusTradeOff({ syllabus, text }: { syllabus: SyllabusView | null; text: string }) {
  const t = useExtracted();
  const { focusTestHref, plan } = usePlanScreen();
  const canChooseFocus = useCanChooseFocus();
  const chooseFocus = useChooseFocus();
  const tested = plan.focusTest !== null && plan.focusTest.state !== "notStarted";
  const testHref = tested ? focusTestHref : undefined;

  const links = [
    syllabus
      ? {
          key: "fits",
          link: <SyllabusTopicsSheet label={t("See what fits")} syllabus={syllabus} />,
        }
      : null,
    canChooseFocus
      ? {
          key: "focus",
          link: (
            <Button onClick={chooseFocus} variant="link">
              {t("Change focus")}
            </Button>
          ),
        }
      : null,
    testHref
      ? {
          key: "test",
          link: (
            <LearnLink className={buttonVariants({ variant: "link" })} href={testHref}>
              {t("What your test changed")}
            </LearnLink>
          ),
        }
      : null,
  ].filter((entry) => entry !== null);

  return (
    <div className="flex flex-col gap-2" data-slot="reveal-coverage">
      <p className="text-muted-foreground text-sm text-pretty">{text}</p>

      <p className={LINKS_CLASS}>
        {links.map((entry) => (
          <Fragment key={entry.key}>{entry.link}</Fragment>
        ))}
      </p>

      {syllabus && <PassMarks passMarks={syllabus.passMarks} />}
    </div>
  );
}

export function RevealCoverage({ syllabus }: { syllabus: SyllabusView | null }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const coverage = usePlanCoverage();
  const canMoveDate = useCanMoveDate();
  const space = useSentenceSpace();
  const [moved, setMoved] = useState(false);
  const move = useMoveDate({ onMoved: () => setMoved(true) });
  const done = useRef<HTMLParagraphElement>(null);
  const shown = hasSyllabusSection(syllabus) ? syllabus : null;
  const covered = moved && !coverage;
  const tradeOff = useFocusTradeOff();
  const testOffer = useFocusTestOffer();
  const checkFocusLabel = useCheckFocusLabel();

  useEffect(() => {
    if (covered) {
      done.current?.focus();
    }
  }, [covered]);

  if (plan.access.freeWeekOver) {
    return <FreeWeekOverNotice />;
  }

  if (tradeOff) {
    return <FocusTradeOff syllabus={shown} text={tradeOff} />;
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
            {space}
            <Button busy={move.pending} onClick={() => void move.move()} variant="link">
              <MoveDateLabel move={move} />
            </Button>
          </>
        )}
      </p>

      {(shown || testOffer) && (
        <p className={LINKS_CLASS}>
          {shown && <SyllabusTopicsSheet syllabus={shown} />}
          {testOffer && (
            <LearnLink className={buttonVariants({ variant: "link" })} href={testOffer.href}>
              {checkFocusLabel(testOffer.minutes)}
            </LearnLink>
          )}
        </p>
      )}

      <MoveDateFailure move={move} />
      {shown && <PassMarks passMarks={shown.passMarks} />}
    </div>
  );
}
