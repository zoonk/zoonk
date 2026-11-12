"use client";

import { type PlanChangeDecisionInput } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { Undo2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { StatusRegion } from "../_components/status-region";
import { SURFACE_CLASS } from "../_components/surface";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { useAppliedLine, useChangeWords, useOfficialDateLine } from "../plan/use-change-sentence";
import { TUTOR_CARD_WIDTH_CLASS } from "./tutor-offer-card";

type Decision = Extract<PlanChangeDecisionInput["status"], "applied" | "declined" | "undone">;

/** Resolves to the change as it stands now, or null when it wasn't saved. */
export type DecideTutorPlanChange = (input: {
  changeId: string;
  status: Decision;
}) => Promise<PlanChangeView | null>;

function useStatusLine(change: PlanChangeView): string | null {
  const t = useExtracted();
  const appliedLine = useAppliedLine();

  switch (change.status) {
    case "applied":
      return appliedLine(change.todaySession);
    case "declined":
      return t("Your plan stays as it was.");
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
    });
  };

  return { answer, failed, isPending };
}

function ChangeActions({
  answer,
  canUndo,
  canApply,
  isPending,
  overridesNotice,
  status,
}: {
  answer: (status: Decision) => void;
  canUndo: boolean;
  canApply: boolean;
  isPending: boolean;
  overridesNotice: boolean;
  status: PlanChangeView["status"];
}) {
  const t = useExtracted();

  if (status === "proposed") {
    return (
      <form className="flex gap-2">
        {canApply && (
          <Button
            className="min-w-0 flex-1"
            disabled={isPending}
            focusableWhenDisabled
            formAction={() => answer("applied")}
            size="sm"
            type="submit"
          >
            <span className="truncate">
              {overridesNotice ? t("Use my date") : t("Change my plan")}
            </span>
          </Button>
        )}
        <Button
          className="min-w-0 flex-1"
          disabled={isPending}
          focusableWhenDisabled
          formAction={() => answer("declined")}
          size="sm"
          type="submit"
          variant="outline"
        >
          <span className="truncate">
            {overridesNotice ? t("Keep official date") : t("Not now")}
          </span>
        </Button>
      </form>
    );
  }

  if (status === "applied" && canUndo) {
    return (
      <form action={() => answer("undone")} className="self-start">
        <Button
          busy={isPending}
          icon={<Undo2Icon aria-hidden="true" />}
          size="sm"
          type="submit"
          variant="outline"
        >
          {t("Undo")}
        </Button>
      </form>
    );
  }

  return null;
}

export function TutorPlanChange({
  change,
  decide,
  onAnswered,
}: {
  change: PlanChangeView;
  decide: DecideTutorPlanChange;
  onAnswered: (change: PlanChangeView) => void;
}) {
  const titleId = useId();
  const cardRef = useRef<HTMLElement>(null);
  const words = useChangeWords()(change);
  const officialDate = useOfficialDateLine()(change);
  const statusLine = useStatusLine(change);
  const { answer, failed, isPending } = useAnswer({ cardRef, change, decide, onAnswered });
  const proposed = change.status === "proposed";

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
      <h3 className="text-sm leading-snug font-semibold text-pretty" id={titleId}>
        {words.title}
      </h3>

      {words.why && <p className="text-muted-foreground text-sm leading-snug">{words.why}</p>}
      {proposed && <PlanEffectDiff effect={change.effect} />}
      {officialDate && <p className="text-sm font-medium">{officialDate}</p>}

      <StatusRegion className="text-muted-foreground text-sm">{statusLine}</StatusRegion>

      <ChangeActions
        answer={answer}
        canApply={change.canApply}
        canUndo={change.canUndo}
        isPending={isPending}
        overridesNotice={change.officialDate !== null}
        status={change.status}
      />

      {failed && <ChangeSaveError />}
    </section>
  );
}
