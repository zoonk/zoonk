"use client";

import { Button } from "@zoonk/ui/components/button";
import { CalendarClockIcon, CircleCheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
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
import { CoverageSwitch, useCoveredText, usePlanCoverage, useTargetText } from "./plan-coverage";
import { ChooseFocus, useCanChooseFocus } from "./plan-focus";

/** "Adjust" opens the plan editor, for anything the one-tap switch doesn't cover. */
function AdjustButton({ onAdjust }: { onAdjust: () => void }) {
  const t = useExtracted();

  return (
    <Button onClick={onAdjust} size="sm" variant="ghost">
      {t("Adjust")}
    </Button>
  );
}

/**
 * A plan that doesn't cover the whole goal in depth by its date says it plainly: the daily time
 * that changes it as the title, with one tap to switch to it, and what the learner's own time
 * covers (every topic, the ones that count most in more depth, or that the ones that count least
 * wait); and the choice of where to focus instead. "Adjust" opens the plan editor where the page
 * has no "Adjust plan" of its own.
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
  const canChooseFocus = useCanChooseFocus();
  const coveredText = useCoveredText();
  const targetText = useTargetText();
  const { openFocus } = usePlanScreen();
  const covered = coveredText(coverage);

  return (
    <NoticeCard className={className} data-slot="plan-notice">
      <NoticeCardLeading>
        <KindTile icon={CalendarClockIcon} kind="lesson" size="sm" />
      </NoticeCardLeading>
      <NoticeCardContent>
        {coverage.target ? (
          <>
            <NoticeCardTitle>{targetText(coverage.target)}</NoticeCardTitle>
            <NoticeCardDescription>{covered}</NoticeCardDescription>
          </>
        ) : (
          <NoticeCardTitle>{covered}</NoticeCardTitle>
        )}

        <NoticeCardActions>
          {coverage.target && (
            <CoverageSwitch onSwitched={onSwitched} target={coverage.target} variant="secondary" />
          )}
          {canChooseFocus && <ChooseFocus openOnArrival={openFocus} variant="ghost" />}
          {onAdjust && <AdjustButton onAdjust={onAdjust} />}
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
        "{lessons, plural, one {# lesson from earlier days comes first} other {# lessons from earlier days come first}}: once you've done them, you're back on track.",
        { lessons: status.lessons },
      ),
    };
  }

  if (status?.kind === "behind") {
    return {
      adjust: false,
      text: t(
        "{minutes, number} more minutes a day for {days, plural, one {# day} other {# days}} gets you back on track.",
        { days: status.days, minutes: status.extraMinutesPerDay },
      ),
    };
  }

  return null;
}

/**
 * What the learner should know about the plan's fit, on a soft panel: how much of the goal their
 * time covers with the time that covers it all, that it no longer fits, or the small fix for a
 * delay. Nothing when it fits and they're on track. No date: the plan's title already says when it
 * ends.
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
  const coverage = usePlanCoverage();
  // Once the learner's switch makes the plan cover everything, the notice says so in place
  // instead of disappearing without a word; a plan that covered it all when read again (after
  // placement, say) changed nothing the learner did, so it says nothing.
  const [switched, setSwitched] = useState(false);
  const covered = switched && coverage === null;
  const status = useStatusText();

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
