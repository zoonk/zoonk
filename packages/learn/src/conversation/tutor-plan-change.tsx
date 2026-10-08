"use client";

import { type PlanChangeDecisionInput } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import {
  CalendarCheck2Icon,
  CalendarCogIcon,
  CalendarSyncIcon,
  CalendarX2Icon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";
import { SURFACE_CLASS } from "../_components/surface";
import { useLearnAnalytics } from "../learn-context";
import { PlanFailedMessage } from "../plan/plan-failed-message";
import {
  useAppliedLine,
  useChangeSentence,
  useOfficialDateLine,
  useProposalEffectText,
} from "../plan/use-change-sentence";

type Decision = Extract<PlanChangeDecisionInput["status"], "applied" | "declined" | "undone">;

/**
 * Saves the learner's answer to a change; resolves to the change as it stands now (whether today's
 * session took it, whether it can still be undone), or null when it wasn't saved.
 */
export type DecideTutorPlanChange = (input: {
  changeId: string;
  status: Decision;
}) => Promise<PlanChangeView | null>;

function ChangeIcon({ status }: { status: PlanChangeView["status"] }) {
  const tone = {
    applied: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    declined: "bg-muted text-muted-foreground",
    proposed: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    replaced: "bg-muted text-muted-foreground",
    undone: "bg-muted text-muted-foreground",
  }[status];

  const Icon = {
    applied: CalendarCheck2Icon,
    declined: CalendarX2Icon,
    proposed: CalendarCogIcon,
    replaced: CalendarSyncIcon,
    undone: CalendarX2Icon,
  }[status];

  return (
    <span
      aria-hidden="true"
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tone)}
    >
      <Icon className="size-4" />
    </span>
  );
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
  isPending,
  overridesNotice,
  status,
}: {
  answer: (status: Decision) => void;
  canUndo: boolean;
  isPending: boolean;
  overridesNotice: boolean;
  status: PlanChangeView["status"];
}) {
  const t = useExtracted();

  if (status === "proposed") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button disabled={isPending} focusableWhenDisabled onClick={() => answer("applied")}>
          {overridesNotice ? t("Use my date anyway") : t("Apply")}
        </Button>
        <Button
          disabled={isPending}
          focusableWhenDisabled
          onClick={() => answer("declined")}
          variant="ghost"
        >
          {overridesNotice ? t("Keep the notice's date") : t("Not now")}
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
 * A change to the plan the buddy proposed in the conversation: what changes in one sentence, what
 * it does to the plan, and Apply or Not now. Nothing changes until the learner taps Apply; once
 * applied it can be undone while it's the plan's latest change.
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
  const sentence = useChangeSentence();
  const effectText = useProposalEffectText();
  const officialDate = useOfficialDateLine()(change);
  const statusLine = useStatusLine(change);
  const { answer, failed, isPending } = useAnswer({ cardRef, change, decide, onAnswered });
  const effect = change.status === "proposed" ? effectText(change) : null;

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        SURFACE_CLASS,
        "focus-visible:ring-ring/50 flex flex-col gap-3 p-4 outline-none focus-visible:ring-[3px]",
      )}
      data-status={change.status}
      ref={cardRef}
      tabIndex={-1}
    >
      <div className="flex items-start gap-3">
        <ChangeIcon status={change.status} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-muted-foreground text-xs font-medium" id={titleId}>
            {t("Change to your plan")}
          </h3>
          <p className="font-medium text-balance">{sentence(change)}</p>
          {effect && <p className="text-muted-foreground text-sm">{effect}</p>}
          {officialDate && <p className="text-sm font-medium">{officialDate}</p>}
        </div>
      </div>

      {statusLine && (
        <p className="text-muted-foreground text-sm" role="status">
          {statusLine}
        </p>
      )}

      <ChangeActions
        answer={answer}
        canUndo={change.canUndo}
        isPending={isPending}
        overridesNotice={change.officialDate !== null}
        status={change.status}
      />

      {failed && <PlanFailedMessage />}
    </section>
  );
}
