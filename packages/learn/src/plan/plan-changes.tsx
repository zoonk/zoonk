"use client";

import { type PlanChangeDecisionInput } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { RefreshCwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { SectionLabel } from "../_components/section-label";
import { ContentThumbs } from "../feedback/content-thumbs";
import { useLearnAnalytics } from "../learn-context";
import { PLAN_CHANGES_TITLE_ID, usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";
import {
  useChangeEffectText,
  useChangeSentence,
  useProposalEffectText,
} from "./use-change-sentence";

type Decision = PlanChangeDecisionInput["status"];
type ItemRef = React.RefObject<HTMLLIElement | null>;

/** Focus follows the decision to the change itself, since its buttons change or leave with it. */
function useDecide({ changeId, itemRef }: { changeId: string; itemRef: ItemRef }) {
  const { actions, keepFocus } = usePlanScreen();
  const analytics = useLearnAnalytics();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const decide = (status: Decision) => {
    setFailed(false);
    keepFocus(() => itemRef.current);

    startTransition(async () => {
      const ok = await actions.decide({ changeId, status });
      setFailed(!ok);

      if (ok) {
        analytics.track({ name: "Plan Edited", properties: { change_kind: `proposal:${status}` } });
      }
    });
  };

  return { decide, failed, isPending };
}

function ChangeActions({ change, itemRef }: { change: PlanChangeView; itemRef: ItemRef }) {
  const t = useExtracted();
  const { decide, failed, isPending } = useDecide({ changeId: change.id, itemRef });

  if (change.status === "proposed") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            disabled={isPending}
            focusableWhenDisabled
            onClick={() => decide("applied")}
            size="sm"
          >
            {t("Apply")}
          </Button>
          <Button
            disabled={isPending}
            focusableWhenDisabled
            onClick={() => decide("declined")}
            size="sm"
            variant="ghost"
          >
            {t("Not now")}
          </Button>
        </div>
        {failed && <PlanFailedMessage />}
      </div>
    );
  }

  if (!change.canUndo) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        className="self-start"
        disabled={isPending}
        focusableWhenDisabled
        onClick={() => decide("undone")}
        size="sm"
        variant="outline"
      >
        {t("Undo")}
      </Button>
      {failed && <PlanFailedMessage />}
    </div>
  );
}

function PlanChangeItem({ change }: { change: PlanChangeView }) {
  const t = useExtracted();
  const sentence = useChangeSentence();
  const effectText = useChangeEffectText();
  const proposalEffectText = useProposalEffectText();
  const itemRef = useRef<HTMLLIElement>(null);
  const isProposal = change.status === "proposed";
  const effect = isProposal ? proposalEffectText(change) : effectText(change);

  return (
    <li
      className={cn(
        "focus-visible:ring-ring/50 flex gap-3 rounded-2xl p-4 outline-none focus-visible:ring-[3px]",
        isProposal ? "bg-card ring-foreground/10 ring-1" : "bg-muted/60",
      )}
      data-status={change.status}
      ref={itemRef}
      tabIndex={-1}
    >
      <RefreshCwIcon aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {isProposal && (
          <p className="text-muted-foreground text-xs font-medium">{t("Waiting for your OK")}</p>
        )}
        <p className="text-sm">{sentence(change)}</p>
        {effect && <p className="text-muted-foreground text-sm">{effect}</p>}
        {change.status === "undone" && (
          <p className="text-muted-foreground text-xs">{t("Undone")}</p>
        )}
        <ChangeActions change={change} itemRef={itemRef} />
      </div>

      {change.status === "applied" && (
        <ContentThumbs
          className="-my-2 -mr-2 self-start"
          target={{ contentId: change.id, contentKind: "planChange" }}
        />
      )}
    </li>
  );
}

/**
 * Proposals waiting for the learner's OK first, then what changed in the last two weeks, each in
 * one sentence with an undo while it can still be undone.
 */
export function PlanChanges() {
  const t = useExtracted();
  const { plan } = usePlanScreen();
  const changes = plan.changes.filter((change) => change.status !== "declined");

  if (changes.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={PLAN_CHANGES_TITLE_ID} className="flex flex-col gap-3">
      <SectionLabel
        className="focus-visible:ring-ring/50 rounded-sm outline-none focus-visible:ring-[3px]"
        id={PLAN_CHANGES_TITLE_ID}
        tabIndex={-1}
      >
        {t("Changes to your plan")}
      </SectionLabel>
      <ul className="flex flex-col gap-2">
        {changes.map((change) => (
          <PlanChangeItem change={change} key={change.id} />
        ))}
      </ul>
    </section>
  );
}
