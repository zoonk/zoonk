"use client";

import { seededShuffle } from "@zoonk/utils/seeded-random";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { ActivityDragDrop } from "../_components/activity-drag-drop";
import { expectedInteraction } from "../_utils/activity-expected";
import { type ActivityRendererProps } from "../activity-renderer";
import { ArgumentCandidates } from "./argument-candidates";
import { type ArgumentPart, ArgumentSlot, ArgumentText, ArgumentWhy } from "./argument-parts";
import { ArgumentReview } from "./argument-review";

type ArgumentBuilderProps = ActivityRendererProps<"argumentBuilder">;
type Picks = Record<ArgumentPart, string | null>;

function picksFromAnswer(
  answer: ArgumentBuilderProps["answer"],
  fields: ArgumentBuilderProps["content"]["fields"],
): Picks {
  const ids = answer?.kind === "selection" ? answer.ids : [];

  return {
    evidence: fields.evidence.find((item) => ids.includes(item.id))?.id ?? null,
    reasoning: fields.reasoning.find((item) => ids.includes(item.id))?.id ?? null,
  };
}

/** The part waiting for a pick: evidence first, then reasoning, then none. */
function nextOpenPart(picks: Picks): ArgumentPart | null {
  if (picks.evidence === null) {
    return "evidence";
  }

  return picks.reasoning === null ? "reasoning" : null;
}

/**
 * Build an argument in three parts: the claim is given, the learner picks the quote that
 * supports it, then the reasoning that ties the quote to the claim. After the check each part
 * says whether the pick is strong, with why, and names the strong one when it wasn't.
 */
export function ArgumentBuilderActivity({
  answer,
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: ArgumentBuilderProps) {
  const t = useExtracted();
  const { fields } = content;
  const isChecked = phase === "checked";
  const [picks, setPicks] = useState<Picks>(() => picksFromAnswer(answer, fields));
  const strongIds = expectedInteraction(expected, "selection")?.ids ?? null;
  const evidence = seededShuffle(fields.evidence, `evidence ${fields.claim}`);
  const reasoning = seededShuffle(fields.reasoning, `reasoning ${fields.claim}`);
  const pickedEvidence = fields.evidence.find((item) => item.id === picks.evidence);
  const pickedReasoning = fields.reasoning.find((item) => item.id === picks.reasoning);

  const openPart = nextOpenPart(picks);

  function update(next: Picks) {
    setPicks(next);

    onAnswerChange(
      next.evidence && next.reasoning
        ? { ids: [next.evidence, next.reasoning], kind: "selection" }
        : null,
    );
  }

  function handleDrop(itemId: string, part: string) {
    const list = part === "evidence" ? fields.evidence : fields.reasoning;

    if (!isChecked && part === openPart && list.some((item) => item.id === itemId)) {
      update({ ...picks, [part]: itemId });
    }
  }

  const resultOf = (id: string | null) => {
    if (!strongIds || !id) {
      return null;
    }

    return strongIds.includes(id) ? "strong" : "weak";
  };

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <ActivityDragDrop onDrop={handleDrop}>
        <div className="flex flex-col gap-2">
          <section aria-label={t("Claim")} className="bg-viz-accent-soft rounded-2xl px-3.5 py-3">
            <p className="text-viz-accent text-xs font-semibold">{t("Claim")}</p>
            <p className="mt-0.5 text-base leading-snug font-medium">
              <LessonRichText text={fields.claim} />
            </p>
          </section>

          <ArgumentSlot
            clearLabel={t("Take the quote out")}
            hint={t("Pick the quote that best supports the claim")}
            isOpen={openPart === "evidence" && !isChecked}
            label={t("Evidence")}
            onClear={
              isChecked || !pickedEvidence ? undefined : () => update({ ...picks, evidence: null })
            }
            part="evidence"
            result={resultOf(picks.evidence)}
          >
            {pickedEvidence && (
              <>
                <ArgumentText citation={pickedEvidence.citation} text={pickedEvidence.quote} />
                {isChecked && <ArgumentWhy text={pickedEvidence.why} />}
              </>
            )}
          </ArgumentSlot>

          <ArgumentSlot
            clearLabel={t("Take the reasoning out")}
            hint={
              openPart === "reasoning"
                ? t("Pick how the quote proves the claim")
                : t("Next: explain how the quote proves the claim")
            }
            isOpen={openPart === "reasoning" && !isChecked}
            label={t("Reasoning")}
            onClear={
              isChecked || !pickedReasoning
                ? undefined
                : () => update({ ...picks, reasoning: null })
            }
            part="reasoning"
            result={resultOf(picks.reasoning)}
          >
            {pickedReasoning && (
              <>
                <ArgumentText text={pickedReasoning.text} />
                {isChecked && <ArgumentWhy text={pickedReasoning.why} />}
              </>
            )}
          </ArgumentSlot>
        </div>

        {!isChecked && openPart !== null && (
          <ArgumentCandidates
            evidence={evidence}
            onChoose={(itemId) => update({ ...picks, [openPart]: itemId })}
            part={openPart}
            reasoning={reasoning}
          />
        )}

        {!isChecked && openPart === null && (
          <ActivityCanvasLabel className="text-center">
            {t("Your argument is ready. Check it, or take a part out to change it.")}
          </ActivityCanvasLabel>
        )}
      </ActivityDragDrop>

      {isChecked && (
        <ArgumentReview
          evidence={fields.evidence}
          picks={picks}
          reasoning={fields.reasoning}
          strongIds={strongIds ?? []}
        />
      )}

      <ActivityTextAlternative>
        {t(
          "An argument in three parts: the claim, then the evidence, then the reasoning. Pick one quote as evidence, then one line of reasoning.",
        )}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
