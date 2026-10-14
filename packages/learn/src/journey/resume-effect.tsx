"use client";

import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
import { useExtracted } from "next-intl";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { useProposalEffectText } from "../plan/use-effect-text";

/**
 * Whether resuming a paused goal changes its plan (see `getGoalResumePreview`): a pause that left
 * nothing behind keeps it, so resuming is one tap with nothing to show.
 */
export function changesOnResume(
  preview: PlanChangePreview | null,
): preview is PlanChangePreview & { ready: true } {
  return preview !== null && preview.ready && !preview.unchanged;
}

/**
 * What resuming does to the plan, in words: it picks up from today, starting with the lessons
 * planned for the paused days (said as plain facts, never as work owed), and what that moves, as a
 * proposal says it ("Ends Dec 23 instead of Dec 16.").
 */
export function useResumeEffectText() {
  const t = useExtracted();
  const proposalEffectText = useProposalEffectText();

  return (preview: PlanChangePreview): string =>
    [
      t(
        "Your plan picks up from today, starting with the lessons planned for the days you paused.",
      ),
      proposalEffectText({ effect: preview.effect }),
    ]
      .filter((sentence) => sentence !== null)
      .join(" ");
}

/**
 * What resuming a paused goal does to its plan, shown before the learner resumes it, as a
 * proposal shows its effect: its sentence, then its diff. Nothing when the plan stays as it is.
 */
export function ResumeEffect({ preview }: { preview: PlanChangePreview | null }) {
  const effectText = useResumeEffectText();

  if (!changesOnResume(preview)) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm text-pretty">{effectText(preview)}</p>
      <PlanEffectDiff effect={preview.effect} />
    </div>
  );
}
