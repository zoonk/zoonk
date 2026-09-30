"use client";

import { type PlanChangeDecisionInput } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Buddy } from "@zoonk/ui/components/buddy";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ScaleIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useState } from "react";
import { type LearnBuddy, useBuddyName } from "../buddies/use-buddy-name";
import { useExperienceMode } from "../mode-provider";

type Decision = PlanChangeDecisionInput["status"];

/** The plan's areas the rebalance put first, from its "focus on" change. */
function getFocusAreas(change: PlanChangeView): string[] {
  const [operation] = change.operations;
  return operation?.kind === "focusAreas" ? operation.areas : [];
}

function Actions({
  change,
  decide,
  pending,
}: {
  change: PlanChangeView;
  decide: (status: Decision) => void;
  pending: boolean;
}) {
  const t = useExtracted();

  if (change.status === "proposed") {
    return (
      <div className="flex gap-2">
        <Button disabled={pending} onClick={() => decide("applied")} size="sm" variant="secondary">
          {t("OK")}
        </Button>
        <Button disabled={pending} onClick={() => decide("declined")} size="sm" variant="ghost">
          {t("Not now")}
        </Button>
      </div>
    );
  }

  // A ghost button has no edge to line up, so its label lines up with the note's text instead.
  return change.canUndo ? (
    <Button
      className="-ml-3"
      disabled={pending}
      onClick={() => decide("undone")}
      size="sm"
      variant="ghost"
    >
      {t("Undo")}
    </Button>
  ) : null;
}

/**
 * After a session, when one area was going well and another needed practice, the plan moved
 * time to the weak one. Fun's buddy says so in one line; Focus shows the same change as a plain
 * line. Either way it can be undone (or, when it waits for an OK, accepted or left).
 */
export function RebalanceNote({
  change,
  className,
  onDecide,
  buddy,
}: {
  change: PlanChangeView;
  className?: string;
  onDecide: (status: Decision) => Promise<boolean>;
  buddy: LearnBuddy | null;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const mode = useExperienceMode();
  const buddyName = useBuddyName(buddy ?? { kind: "zu", name: null });
  const [hidden, setHidden] = useState(false);
  const [pending, setPending] = useState(false);
  const areas = format.list(getFocusAreas(change), { type: "conjunction" });

  if (hidden || !areas) {
    return null;
  }

  async function decide(status: Decision) {
    setPending(true);
    const saved = await onDecide(status);
    setPending(false);
    setHidden(saved);
  }

  const isFun = mode === "fun" && buddy;

  return (
    <section
      aria-label={t("Plan change")}
      className={cn(
        "border-border in-data-[mode=fun]:fun-glass flex items-start gap-3 rounded-2xl border p-3",
        className,
      )}
      data-slot="rebalance-note"
    >
      {isFun ? (
        <Buddy
          beltColor={buddy.beltColor}
          className="size-12 shrink-0"
          energy={buddy.energy}
          expression="happy"
          glasses={buddy.glasses}
          kind={buddy.kind}
          studiedToday={buddy.studiedToday}
        />
      ) : (
        <span aria-hidden="true" className="flex h-8 shrink-0 items-center">
          <ScaleIcon className="text-muted-foreground size-5" />
        </span>
      )}

      {/* The buttons sit beside a short sentence and move under a long one, never squeezing it. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3">
        <p className="min-w-0 py-1.5 text-sm">
          {isFun
            ? t("{buddy} moved time to {areas}, where it's needed most.", {
                areas,
                buddy: buddyName,
              })
            : t("More time for {areas}, where it's needed most.", { areas })}
        </p>

        <Actions change={change} decide={(status) => void decide(status)} pending={pending} />
      </div>
    </section>
  );
}
