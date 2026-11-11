"use client";

import { type FocusTestFocus } from "@zoonk/core/learner/placement/focus-test-contract";
import { Button } from "@zoonk/ui/components/button";
import { Undo2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { useProposalEffectText } from "../plan/use-effect-text";

type Proposal = NonNullable<FocusTestFocus["proposal"]>;
type Decision = "applied" | "declined" | "undone";

export type FocusTestPlanActions = {
  changeFocusHref: string;
  /** The change as it stands after the answer; null when it wasn't saved. */
  decide: (input: { changeId: string; status: Decision }) => Promise<Proposal | null>;
};

const TEXT_CLASS = "text-sm text-pretty";

function ProposalAnswer({
  canUndo,
  decision,
  isPending,
  onUndo,
}: {
  canUndo: boolean;
  decision: Decision;
  isPending: boolean;
  onUndo: () => void;
}) {
  const t = useExtracted();

  if (decision !== "applied") {
    return (
      <p className={TEXT_CLASS} role="status">
        {decision === "undone"
          ? t("Undone. Your plan is back as it was.")
          : t("Your plan stays as it was.")}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p className={TEXT_CLASS} role="status">
        {t("Done. Your plan now gives these more time.")}
      </p>
      {canUndo && (
        <Button
          busy={isPending}
          icon={<Undo2Icon aria-hidden="true" />}
          onClick={onUndo}
          size="sm"
          variant="outline"
        >
          {t("Undo")}
        </Button>
      )}
    </div>
  );
}

export function FocusProposal({
  onAnswered,
  plan,
  proposal,
}: {
  onAnswered?: () => void;
  plan: FocusTestPlanActions;
  proposal: Proposal;
}) {
  const t = useExtracted();
  const effectText = useProposalEffectText();
  const [answered, setAnswered] = useState<{ change: Proposal; decision: Decision } | null>(null);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pressed, setPressed] = useState<Decision | null>(null);
  const effect = effectText(proposal, undefined, { besideDiff: true });

  const decide = (status: Decision) => {
    setPressed(status);

    startTransition(async () => {
      const change = await plan.decide({ changeId: proposal.id, status }).catch(() => null);
      setFailed(!change);

      if (change) {
        setAnswered({ change, decision: status });
        onAnswered?.();
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {answered?.decision !== "applied" && (
        <>
          {effect && <p className="text-muted-foreground text-sm text-pretty">{effect}</p>}
          <PlanEffectDiff effect={proposal.effect} />
        </>
      )}

      {answered ? (
        <ProposalAnswer
          canUndo={answered.change.canUndo}
          decision={answered.decision}
          isPending={isPending}
          onUndo={() => decide("undone")}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {proposal.canApply && (
            <Button
              busy={isPending && pressed === "applied"}
              disabled={isPending}
              focusableWhenDisabled
              onClick={() => decide("applied")}
              size="sm"
            >
              {t("Update my plan")}
            </Button>
          )}
          <Button
            busy={isPending && pressed === "declined"}
            disabled={isPending}
            focusableWhenDisabled
            onClick={() => decide("declined")}
            size="sm"
            variant="outline"
          >
            {t("Not now")}
          </Button>
        </div>
      )}

      {failed && <ChangeSaveError />}
    </div>
  );
}
