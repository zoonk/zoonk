"use client";

import { type PlanChangeDecisionInput } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";
import { CHIP_CLASS } from "../_components/chip";
import { ChangeSaveError } from "../_components/save-error";
import { SURFACE_CLASS } from "../_components/surface";
import { useLearnAnalytics } from "../learn-context";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import {
  useAddedTopicsStartText,
  useAreaEndTexts,
  useAreaStartTexts,
  useReviewFirstText,
} from "../plan/use-area-start-texts";
import {
  useAppliedLine,
  useChangeSentence,
  useKeepOfficialDateLabel,
  useOfficialDateLine,
} from "../plan/use-change-sentence";
import { useLessonsEffectText, useTopicsEffectText } from "../plan/use-effect-counts";
import { TUTOR_CARD_WIDTH_CLASS } from "./tutor-offer-card";

type Decision = Extract<PlanChangeDecisionInput["status"], "applied" | "declined" | "undone">;

/**
 * Saves the learner's answer to a change; resolves to the change as it stands now (whether today's
 * session took it, whether it can still be undone), or null when it wasn't saved.
 */
export type DecideTutorPlanChange = (input: {
  changeId: string;
  status: Decision;
}) => Promise<PlanChangeView | null>;

type ChangeEffect = NonNullable<PlanChangeView["effect"]>;

/**
 * What else a proposal does, in words under its diff (`PlanEffectDiff`, which counts the lessons it
 * leaves out or adds first, then every date and count that moves): the lessons it leaves out by
 * name, the topics, when focused areas start, an area that still ends on its day, the review it
 * opens. Null when the diff says it all.
 */
function useChangeFootnote() {
  const lessonsText = useLessonsEffectText();
  const topicsText = useTopicsEffectText();
  const areaStartTexts = useAreaStartTexts();
  const areaEndTexts = useAreaEndTexts();
  const addedTopicsStartText = useAddedTopicsStartText();
  const reviewFirstText = useReviewFirstText();

  return function changeFootnote(effect: PlanChangeView["effect"]): string | null {
    if (!effect) {
      return null;
    }

    const ends: ChangeEffect["areaEnds"] = effect.areaEnds ?? [];

    // A start that stays says nothing when a review ahead opens with the area, or its end moves.
    const starts = (effect.areaStarts ?? []).filter(
      (start) =>
        start.after !== start.before ||
        (!effect.reviewFirst && !ends.some((areaEnd) => areaEnd.area === start.area)),
    );

    const sentences = [
      ...areaStartTexts(starts),
      // An end that moves is in the diff; one that stays says why.
      ...areaEndTexts(ends.filter((areaEnd) => areaEnd.after === areaEnd.before)),
      reviewFirstText(effect),
      lessonsText(effect, { named: true }),
      addedTopicsStartText(effect),
      topicsText(effect),
    ].filter(Boolean);

    return sentences.length > 0 ? sentences.join(" ") : null;
  };
}

/** How long a change lasts, when it's for a while only: a light week, a weekly event moved. */
function ChangeScope({ operations }: { operations: PlanChangeView["operations"] }) {
  const t = useExtracted();

  const oneWeek = operations.some(
    (operation) => operation.kind === "addLightWeek" || operation.kind === "moveWeeklyEvent",
  );

  if (!oneWeek) {
    return null;
  }

  return <span className={CHIP_CLASS}>{t("1 week")}</span>;
}

/** What became of the change, in the place its buttons were. */
function useStatusLine(change: PlanChangeView): string | null {
  const t = useExtracted();
  const appliedLine = useAppliedLine();

  switch (change.status) {
    case "applied":
      return appliedLine(change.todaySession);
    case "declined":
      return t("Not applied. Your plan stays as it was.");
    case "undone":
      return t("Undone. Your plan is back as it was.");
    case "replaced":
      return t("A newer suggestion replaced this one.");
    case "proposed":
      return null;
    default:
      return change.status satisfies never;
  }
}

function useAnswer({
  cardRef,
  change,
  decide,
  onAnswered,
}: {
  cardRef: React.RefObject<HTMLElement | null>;
  change: PlanChangeView;
  decide: DecideTutorPlanChange;
  onAnswered: (change: PlanChangeView) => void;
}) {
  const analytics = useLearnAnalytics();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const answer = (status: Decision) => {
    setFailed(false);

    startTransition(async () => {
      const { data: answered } = await safeAsync(() => decide({ changeId: change.id, status }));

      if (!answered) {
        setFailed(true);
        return;
      }

      onAnswered(answered);
      // The buttons leave with the answer, so focus stays on the card that says how it went.
      cardRef.current?.focus();
      analytics.track({ name: "Plan Edited", properties: { change_kind: `tutor:${status}` } });
    });
  };

  return { answer, failed, isPending };
}

/**
 * Apply or Not now; for a change that moves the exam off the day its notice sets, the buttons say
 * what each one keeps: the learner's own date anyway, or the notice's.
 */
function ChangeActions({
  answer,
  canUndo,
  canApply,
  document,
  isPending,
  overridesNotice,
  status,
}: {
  answer: (status: Decision) => void;
  canUndo: boolean;
  canApply: boolean;
  document: PlanChangeView["examDocument"];
  isPending: boolean;
  overridesNotice: boolean;
  status: PlanChangeView["status"];
}) {
  const t = useExtracted();
  const keepOfficialDate = useKeepOfficialDateLabel();

  if (status === "proposed") {
    return (
      <div className="flex gap-2">
        {canApply && (
          <Button
            className="min-w-0 flex-1"
            disabled={isPending}
            focusableWhenDisabled
            onClick={() => answer("applied")}
            size="sm"
          >
            <span className="truncate">
              {overridesNotice ? t("Use my date anyway") : t("Apply")}
            </span>
          </Button>
        )}
        <Button
          className="min-w-0 flex-1"
          disabled={isPending}
          focusableWhenDisabled
          onClick={() => answer("declined")}
          size="sm"
          variant="outline"
        >
          <span className="truncate">
            {overridesNotice ? keepOfficialDate(document) : t("Not now")}
          </span>
        </Button>
      </div>
    );
  }

  if (status === "applied" && canUndo) {
    return (
      <Button
        className="self-start"
        disabled={isPending}
        focusableWhenDisabled
        onClick={() => answer("undone")}
        size="sm"
        variant="outline"
      >
        {t("Undo")}
      </Button>
    );
  }

  return null;
}

/**
 * A change to the plan the buddy proposed in the conversation, on one panel: what changes in one
 * sentence (and for how long, when it's for a week), what it moves as a diff (the lessons it leaves
 * out or adds first, then each date and count as it is now and as it would be), what else it does
 * in a quiet line, and Apply or Not now side by side. The sentence stays once it's answered.
 * Nothing changes until the learner taps Apply; once applied it can be undone while it's the
 * plan's latest change.
 */
export function TutorPlanChange({
  change,
  decide,
  onAnswered,
}: {
  change: PlanChangeView;
  decide: DecideTutorPlanChange;
  onAnswered: (change: PlanChangeView) => void;
}) {
  const t = useExtracted();
  const titleId = useId();
  const cardRef = useRef<HTMLElement>(null);
  const changeFootnote = useChangeFootnote();
  const sentence = useChangeSentence()(change);
  const officialDate = useOfficialDateLine()(change);
  const statusLine = useStatusLine(change);
  const { answer, failed, isPending } = useAnswer({ cardRef, change, decide, onAnswered });
  const proposed = change.status === "proposed";
  const footnote = proposed ? changeFootnote(change.effect) : null;

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        SURFACE_CLASS,
        TUTOR_CARD_WIDTH_CLASS,
        "focus-visible:ring-ring/50 flex flex-col gap-3 p-3 outline-none focus-visible:ring-[3px]",
      )}
      data-status={change.status}
      ref={cardRef}
      tabIndex={-1}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-[0.8125rem] leading-snug font-semibold" id={titleId}>
            {t("Change to your plan")}
          </h3>
        </div>
        <ChangeScope operations={change.operations} />
      </div>

      {/* What the change is, then what it does: the diff leads with the lessons it moves. */}
      <p className="text-sm leading-snug">{sentence}</p>
      {proposed && <PlanEffectDiff effect={change.effect} />}
      {footnote && <p className="text-muted-foreground text-xs leading-snug">{footnote}</p>}
      {officialDate && <p className="text-sm font-medium">{officialDate}</p>}

      {statusLine && (
        <p className="text-muted-foreground text-sm" role="status">
          {statusLine}
        </p>
      )}

      <ChangeActions
        answer={answer}
        canApply={change.canApply}
        canUndo={change.canUndo}
        document={change.examDocument}
        isPending={isPending}
        overridesNotice={change.officialDate !== null}
        status={change.status}
      />

      {failed && <ChangeSaveError />}
    </section>
  );
}
