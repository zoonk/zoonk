"use client";

import { Button } from "@zoonk/ui/components/button";
import { CalendarClockIcon, CircleCheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { FreeWeekOverNotice } from "../_components/free-week-over";
import { KindTile } from "../_components/kind-tile";
import {
  NoticeCard,
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardLeading,
  NoticeCardTitle,
} from "../_components/notice-card";
import { usePlanScreen } from "./plan-context";
import {
  CoverageAction,
  useCoveredText,
  useFittingDateText,
  usePlanCoverage,
  useTargetText,
} from "./plan-coverage";
import { PlanFailedMessage } from "./plan-failed-message";
import { ChooseFocus, useCanChooseFocus } from "./plan-focus";
import { useFullCourse, useFullCourseText } from "./plan-full-course";
import { StudyEverything } from "./study-everything";
import { usePlanChange } from "./use-plan-change";

/** "Adjust" opens the plan editor, for anything the one-tap switch doesn't cover. */
function AdjustButton({ onAdjust }: { onAdjust: () => void }) {
  const t = useExtracted();

  return (
    <Button onClick={onAdjust} size="sm" variant="ghost">
      {t("Adjust")}
    </Button>
  );
}

/** "Only until the exam": the plan ends at the exam again, leaving out what doesn't fit. */
function OnlyUntilExam() {
  const t = useExtracted();
  const { change, failed, isPending } = usePlanChange();

  return (
    <>
      <Button
        disabled={isPending}
        focusableWhenDisabled
        onClick={() => void change([{ fullCourse: false, kind: "setFullCourse" }])}
        size="sm"
        variant="ghost"
      >
        {t("Only until the exam")}
      </Button>
      {failed && <PlanFailedMessage />}
    </>
  );
}

/**
 * What the notice says first: an exam studying everything says when it ends, after the exam;
 * otherwise the daily time that covers the goal (or what the most time covers, when none does),
 * with what the learner's own time covers, or that alone when no time covers more; and the date
 * their time covers it all by, when they can move theirs.
 */
function CoverageHeading({
  coverage,
  course,
}: {
  coverage: NonNullable<ReturnType<typeof usePlanCoverage>>;
  course: ReturnType<typeof useFullCourse>;
}) {
  const t = useExtracted();
  const coveredText = useCoveredText();
  const targetText = useTargetText();
  const fittingDateText = useFittingDateText();
  const { plan } = usePlanScreen();
  const fullCourseText = useFullCourseText();
  const covered = coveredText(coverage);

  const fitting = coverage.fittingDate && (
    <NoticeCardDescription>
      {fittingDateText({
        dailyMinutes: plan.schedule.dailyMinutes,
        fittingDate: coverage.fittingDate,
      })}
    </NoticeCardDescription>
  );

  if (course?.on) {
    return (
      <>
        <NoticeCardTitle>{fullCourseText.finish(course)}</NoticeCardTitle>
        <NoticeCardDescription>
          {t("Until the exam, what comes up most comes first.")}
        </NoticeCardDescription>
      </>
    );
  }

  if (!coverage.target) {
    return (
      <>
        <NoticeCardTitle>{covered}</NoticeCardTitle>
        {fitting}
      </>
    );
  }

  return (
    <>
      <NoticeCardTitle>{targetText(coverage.target)}</NoticeCardTitle>
      <NoticeCardDescription>{covered}</NoticeCardDescription>
      {fitting}
    </>
  );
}

/**
 * The other ways to change what the plan covers, where the card has no "Adjust" leading to them in
 * the plan editor: where to focus, and studying everything at the learner's own pace (an exam's
 * after the exam), or, while an exam's plan studies everything, ending at the exam again.
 */
function CoverageShortcuts({
  coverage,
  course,
}: {
  coverage: NonNullable<ReturnType<typeof usePlanCoverage>>;
  course: ReturnType<typeof useFullCourse>;
}) {
  const canChooseFocus = useCanChooseFocus();

  return (
    <>
      {canChooseFocus && <ChooseFocus variant="ghost" />}
      {course && !course.on && !coverage.fittingDate && <StudyEverything course={course} />}
      {course?.on && <OnlyUntilExam />}
    </>
  );
}

/**
 * A plan that doesn't cover the whole goal in depth by its date says it plainly: the daily time
 * that changes it as the title, with one tap to switch to it, and what the learner's own time
 * covers (every topic, the ones that count most in more depth, or that the ones that count least
 * wait). When no daily time covers a goal that isn't an exam, the one tap moves its date to the day
 * their time covers it all by. An exam studying everything says when it ends. Beside the one tap,
 * "Adjust" opens the plan editor, which holds every other way, so the card never shows four
 * buttons that read alike; where the page has its own "Adjust plan", the card offers those ways
 * itself (`CoverageShortcuts`).
 */
function CoverageNotice({
  className,
  coverage,
  onAdjust,
  onSwitched,
}: {
  className?: string;
  coverage: NonNullable<ReturnType<typeof usePlanCoverage>>;
  onAdjust: (() => void) | null;
  onSwitched: () => void;
}) {
  const course = useFullCourse();

  return (
    <NoticeCard className={className} data-slot="plan-notice">
      <NoticeCardLeading>
        <KindTile icon={CalendarClockIcon} kind="lesson" size="sm" />
      </NoticeCardLeading>
      <NoticeCardContent>
        <CoverageHeading coverage={coverage} course={course} />

        <NoticeCardActions>
          <CoverageAction coverage={coverage} onSwitched={onSwitched} variant="secondary" />
          {onAdjust ? (
            <AdjustButton onAdjust={onAdjust} />
          ) : (
            <CoverageShortcuts coverage={coverage} course={course} />
          )}
        </NoticeCardActions>
      </NoticeCardContent>
    </NoticeCard>
  );
}

/** The plan's status in one sentence: no longer fitting, or the small fix for a delay. */
function useStatusText(): { adjust: boolean; text: string } | null {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const { status } = plan;

  if (status?.kind === "needsAdjusting") {
    return { adjust: true, text: t("Your plan no longer fits in the time left.") };
  }

  if (status?.kind === "behind" && status.lessons) {
    return {
      adjust: false,
      text: t(
        "{lessons, plural, one {# lesson from earlier days comes first} other {# lessons from earlier days come first}}: once you've done them, you're keeping pace again.",
        { lessons: status.lessons },
      ),
    };
  }

  if (status?.kind === "behind") {
    return {
      adjust: false,
      text: t(
        "{minutes, number} more minutes a day for {days, plural, one {# day} other {# days}} and you're keeping pace again.",
        { days: status.days, minutes: status.extraMinutesPerDay },
      ),
    };
  }

  return null;
}

/**
 * What the learner should know about the plan's fit, on a soft panel: how much of the goal their
 * time covers with the time that covers it all, that it no longer fits, or the small fix for a
 * delay. Nothing when it fits and they're keeping pace. No date: the plan's title already says when it
 * ends. Past a free exam plan's first week, more time a day opens nothing new: it says what Plus
 * opens instead.
 */
export function PlanNotice({
  adjustInNotice = true,
  className,
  onAdjust,
}: {
  /** False where the page has its own "Adjust plan" (the Journey's preparation card). */
  adjustInNotice?: boolean;
  className?: string;
  onAdjust: () => void;
}) {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const coverage = usePlanCoverage();
  // Once the learner's switch makes the plan cover everything, the notice says so in place
  // instead of disappearing without a word; a plan that covered it all when read again (after
  // placement, say) changed nothing the learner did, so it says nothing.
  const [switched, setSwitched] = useState(false);
  const covered = switched && coverage === null;
  const status = useStatusText();

  if (plan.access.freeWeekOver) {
    return <FreeWeekOverNotice className={className} />;
  }

  if (coverage) {
    return (
      <CoverageNotice
        className={className}
        coverage={coverage}
        onAdjust={adjustInNotice ? onAdjust : null}
        onSwitched={() => setSwitched(true)}
      />
    );
  }

  if (covered) {
    return (
      <NoticeCard className={className} data-slot="plan-notice" role="status">
        <NoticeCardLeading>
          <CircleCheckIcon className="text-success size-8" />
        </NoticeCardLeading>
        <NoticeCardContent className="self-center">
          <NoticeCardTitle>{t("Done. Your plan now covers your whole goal.")}</NoticeCardTitle>
        </NoticeCardContent>
      </NoticeCard>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <NoticeCard className={className} data-slot="plan-notice">
      <NoticeCardLeading>
        <KindTile icon={CalendarClockIcon} kind="lesson" size="sm" />
      </NoticeCardLeading>
      <NoticeCardContent className="self-center">
        <NoticeCardTitle>{status.text}</NoticeCardTitle>
        {status.adjust && (
          <NoticeCardActions>
            <AdjustButton onAdjust={onAdjust} />
          </NoticeCardActions>
        )}
      </NoticeCardContent>
    </NoticeCard>
  );
}
