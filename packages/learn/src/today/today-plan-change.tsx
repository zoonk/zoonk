"use client";

import { NOTICE_SOURCE } from "@zoonk/core/plans/change-contract";
import { type PlanChangeDecisionInput } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { REBALANCE_SOURCE } from "@zoonk/core/preparation/rebalance";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import {
  CalendarClockIcon,
  FastForwardIcon,
  FileClockIcon,
  RefreshCwIcon,
  ScaleIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { KindTile } from "../_components/kind-tile";
import {
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardLeading,
  NoticeCardTitle,
} from "../_components/notice-card";
import { SURFACE_CLASS } from "../_components/surface";
import { BuddyArt } from "../buddies/buddy-art";
import { useLearnAnalytics } from "../learn-context";
import {
  useAppliedLine,
  useChangeSentence,
  useOfficialDateLine,
  useProposalEffectText,
} from "../plan/use-change-sentence";
import { useTodayScreen } from "./today-context";
import { FallingBehindNotice } from "./today-falling-behind";

type Change = NonNullable<TodayView["planChange"]>;
type Decision = PlanChangeDecisionInput["status"];
type AnswerState = { answer: Decision; answered: PlanChangeView } | { failed: true } | null;

function getChangeIcon(change: Change) {
  if (change.source === NOTICE_SOURCE) {
    return FileClockIcon;
  }

  if (change.kind === "testedOut") {
    return FastForwardIcon;
  }

  if (change.kind === "missedDays") {
    return CalendarClockIcon;
  }

  if (change.source === REBALANCE_SOURCE) {
    return ScaleIcon;
  }

  return RefreshCwIcon;
}

/**
 * Who brings the change, beside its words: the buddy's face for a suggestion (it's the one who
 * proposes), the notice's or the change's own icon otherwise.
 */
function ChangeLeading({ change }: { change: Change }) {
  const { buddy } = useTodayScreen();

  if (change.status === "proposed" && change.source !== NOTICE_SOURCE) {
    return <BuddyArt buddy={buddy} className="size-10" />;
  }

  return <KindTile icon={getChangeIcon(change)} kind="lesson" size="sm" />;
}

/**
 * The notice's title: what kind of change it is, before the sentence that says what it does. A
 * change the exam's notice brings says so in its own sentence ("The exam notice puts the exam on…"),
 * so that sentence is the title.
 */
function useChangeTitle() {
  const t = useExtracted();

  return (change: Change): string => {
    if (change.source === NOTICE_SOURCE) {
      return "";
    }

    if (change.status === "proposed") {
      return t("A suggestion for your plan");
    }

    if (change.kind === "testedOut") {
      return t("Lessons skipped");
    }

    return t("Your plan changed");
  };
}

/** "We skipped 3 lessons of Electric circuits"; any other change in the plan's own words. */
function useTodayChangeSentence() {
  const t = useExtracted();
  const changeSentence = useChangeSentence();

  return (change: Change): string => {
    if (change.kind !== "testedOut") {
      return changeSentence(change);
    }

    return change.chapterTitle
      ? t("We skipped {lessons, plural, one {# lesson} other {# lessons}} of {chapter}", {
          chapter: change.chapterTitle,
          lessons: change.lessonsSkipped,
        })
      : t("We skipped {lessons, plural, one {# lesson} other {# lessons}} you already know", {
          lessons: change.lessonsSkipped,
        });
  };
}

/** What a proposal does to the plan, said as the Journey says its end: "Adds 6 lessons." */
function ProposalEffect({ change }: { change: Change }) {
  const proposalEffectText = useProposalEffectText();
  const { planEnd, today } = useTodayScreen();
  const targetDate = today.goal.targetDate?.toISOString().slice(0, "YYYY-MM-DD".length) ?? null;
  const effect = proposalEffectText(change, { endDate: planEnd, targetDate });

  if (!effect) {
    return null;
  }

  return <NoticeCardDescription>{effect}</NoticeCardDescription>;
}

/** What the answer did, said where the buttons were: an applied change says what it did to today. */
function useAnsweredText(change: Change) {
  const t = useExtracted();
  const appliedLine = useAppliedLine();

  return ({ answer, answered }: { answer: Decision; answered: PlanChangeView }): string => {
    switch (answer) {
      case "applied":
        return appliedLine(answered.todaySession);
      case "declined":
        return t("Your plan stays as it was.");
      case "undone":
        return change.kind === "testedOut"
          ? t("The lessons are back in your plan.")
          : t("Undone. Your plan is back as it was.");
      case "seen":
        return t("Noted.");
      default:
        return t("Noted.");
    }
  };
}

/**
 * "Apply" or "Not now" for a proposal ("Keep mine" for one the exam's notice brings, since the
 * answer stays); "Got it", and "Undo" while it can be, for a change made.
 */
function ChangeActions({
  change,
  disabled,
  onAnswer,
}: {
  change: Change;
  disabled: boolean;
  onAnswer: (answer: Decision) => void;
}) {
  const t = useExtracted();
  const proposal = change.status === "proposed";
  const overridesNotice = proposal && change.officialDate !== null;

  return (
    <NoticeCardActions>
      <Button
        disabled={disabled}
        focusableWhenDisabled
        onClick={() => onAnswer(proposal ? "applied" : "seen")}
        size="sm"
      >
        {overridesNotice && t("Use my date anyway")}
        {proposal && !overridesNotice && t("Apply")}
        {!proposal && t("Got it")}
      </Button>

      {(proposal || change.canUndo) && (
        <Button
          disabled={disabled}
          focusableWhenDisabled
          onClick={() => onAnswer(proposal ? "declined" : "undone")}
          size="sm"
          variant="ghost"
        >
          {proposal && change.source === NOTICE_SOURCE && t("Keep mine")}
          {overridesNotice && t("Keep the notice's date")}
          {proposal && change.source !== NOTICE_SOURCE && !overridesNotice && t("Not now")}
          {!proposal && t("Undo")}
        </Button>
      )}
    </NoticeCardActions>
  );
}

/**
 * Answers the change in place: the buttons give way to what the answer did, and focus stays on the
 * notice so the keyboard doesn't lose its place.
 */
function useAnswer({
  change,
  notice,
}: {
  change: Change;
  notice: React.RefObject<HTMLElement | null>;
}) {
  const analytics = useLearnAnalytics();
  const { actions } = useTodayScreen();
  const [state, setState] = useState<AnswerState>(null);
  const [isPending, startTransition] = useTransition();

  const answer = (status: Decision) => {
    startTransition(async () => {
      const { data: saved } = await safeAsync(() =>
        actions.decidePlanChange({ changeId: change.id, status }),
      );

      setState(saved ? { answer: status, answered: saved } : { failed: true });

      if (!saved) {
        return;
      }

      notice.current?.focus();

      if (status !== "seen") {
        const kind = change.status === "proposed" ? "proposal" : `undo:${change.kind}`;
        analytics.track({ name: "Plan Edited", properties: { change_kind: `today:${kind}` } });
      }
    });
  };

  return { answer, isPending, state };
}

/**
 * Every proposal waits for its own answer: once this one is answered, the next one still waiting
 * (from the buddy, the exam's notice or the plan) comes up when the learner asks for it.
 */
function NextSuggestion({ onNext }: { onNext: () => void }) {
  const t = useExtracted();

  return (
    <Button onClick={onNext} size="sm" variant="outline">
      {t("Next suggestion")}
    </Button>
  );
}

function PlanChangeNotice({
  change,
  focusOnMount = false,
  onNext,
}: {
  change: Change;
  /** It replaced the answered one in place, so the keyboard lands on it. */
  focusOnMount?: boolean;
  /** Shows the next proposal still waiting, once this one is answered; null when none waits. */
  onNext: (() => void) | null;
}) {
  const t = useExtracted();
  const sentence = useTodayChangeSentence();
  const changeTitle = useChangeTitle();
  const answeredText = useAnsweredText(change);
  const officialDate = useOfficialDateLine()(change);
  const notice = useRef<HTMLElement>(null);
  const { answer, isPending, state } = useAnswer({ change, notice });
  const proposal = change.status === "proposed";
  const title = changeTitle(change);

  useEffect(() => {
    if (focusOnMount) {
      notice.current?.focus();
    }
  }, [focusOnMount]);

  return (
    <section
      aria-label={proposal ? t("Suggested change") : t("Plan change")}
      className={cn(
        SURFACE_CLASS,
        "focus-visible:ring-ring/50 flex items-start gap-3 p-4 outline-none focus-visible:ring-[3px]",
      )}
      data-slot="today-plan-change"
      ref={notice}
      tabIndex={-1}
    >
      <NoticeCardLeading>
        <ChangeLeading change={change} />
      </NoticeCardLeading>

      <NoticeCardContent>
        {title ? (
          <>
            <NoticeCardTitle>{title}</NoticeCardTitle>
            <NoticeCardDescription>{sentence(change)}</NoticeCardDescription>
          </>
        ) : (
          <NoticeCardTitle>{sentence(change)}</NoticeCardTitle>
        )}
        {proposal && <ProposalEffect change={change} />}
        {officialDate && <p className="text-sm font-medium">{officialDate}</p>}

        {state && "answer" in state ? (
          <div className="mt-2.5 flex flex-col items-start gap-2">
            <p className="text-sm font-medium" role="status">
              {answeredText(state)}
            </p>
            {onNext && <NextSuggestion onNext={onNext} />}
          </div>
        ) : (
          <ChangeActions change={change} disabled={isPending} onAnswer={answer} />
        )}

        {state && "failed" in state && (
          <p className="text-destructive mt-2 text-sm" role="alert">
            {t("We couldn't save that. Try again.")}
          </p>
        )}
      </NoticeCardContent>
    </section>
  );
}

/**
 * The change shown when Today opened stays while the learner is here, so answering it shows what
 * the answer did. One that turns up later shows when none did. Today reads itself again after an
 * answer: a different proposal still waiting comes up when the learner asks (`showNext`).
 */
function useShownChange(change: Change | null) {
  const [shown, setShown] = useState<{ change: Change; swapped: boolean } | null>(
    change ? { change, swapped: false } : null,
  );

  if (shown === null && change !== null) {
    setShown({ change, swapped: false });
  }

  const current = shown?.change ?? change;
  const next = change?.status === "proposed" && change.id !== current?.id ? change : null;

  return {
    current,
    showNext: next ? () => setShown({ change: next, swapped: true }) : null,
    swapped: shown?.swapped ?? false,
  };
}

/**
 * Today's plan change, the one place to answer it: a proposal ("Apply" or "Not now"), falling
 * behind that puts the date at risk (more time, focus or keep), or an automatic change of the last
 * day, such as a rebalance or a test-out ("We skipped 3 lessons of Electric circuits"), with "Got
 * it" and its undo while the plan is still as it left it.
 */
export function TodayPlanChange() {
  const { today } = useTodayScreen();
  const { current: change, showNext, swapped } = useShownChange(today.planChange);

  if (!change) {
    return null;
  }

  if (change.kind === "missedDays" && change.behind) {
    return <FallingBehindNotice behind={change.behind} change={change} key={change.id} />;
  }

  return (
    <PlanChangeNotice change={change} focusOnMount={swapped} key={change.id} onNext={showNext} />
  );
}
