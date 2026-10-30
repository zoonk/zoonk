"use client";

import { type DuelDecision } from "@zoonk/core/checkpoints/contract";
import { useExtracted } from "next-intl";
import { FeedbackExplanation, FeedbackPanel, FeedbackVerdict } from "../_components/feedback-panel";
import { useCheckpointScreen } from "./checkpoint-context";
import { getDuelScore } from "./checkpoint-duel-state";

function DecisionLine({ decision }: { decision: DuelDecision }) {
  const t = useExtracted();
  const { duel } = useCheckpointScreen();

  if (decision === "won") {
    return t("His shield is broken. You won!");
  }

  return (
    <>
      {t("His shield held this time.")}{" "}
      {t(
        "{lessons, plural, =0 {New try tomorrow. Nothing is lost.} one {New try tomorrow, after # short lesson. Nothing is lost.} other {New try tomorrow, after # short lessons. Nothing is lost.}}",
        { lessons: duel.state.reinforcementLessons },
      )}
    </>
  );
}

export function Verdict({
  decision,
  isCorrect,
}: {
  decision: DuelDecision | null;
  isCorrect: boolean;
}) {
  const t = useExtracted();

  return (
    <FeedbackPanel aria-live="polite" role="status">
      <FeedbackVerdict tone={isCorrect ? "right" : "wrong"}>
        {isCorrect
          ? t("Correct!")
          : t({ description: "Marks the learner's answer as wrong.", message: "Not quite" })}
      </FeedbackVerdict>

      {!isCorrect && !decision && (
        <FeedbackExplanation>{t("You'll see why at the end.")}</FeedbackExplanation>
      )}

      {decision && (
        <FeedbackExplanation>
          <DecisionLine decision={decision} />
        </FeedbackExplanation>
      )}
    </FeedbackPanel>
  );
}

export function DuelOver() {
  const t = useExtracted();
  const { checkpoint, duel } = useCheckpointScreen();
  const { answered, decision } = getDuelScore({ checkpoint, state: duel.state });

  if (!decision && answered === 0) {
    return null;
  }

  return (
    <p className="text-foreground text-[0.9375rem] leading-6 text-pretty" role="status">
      {decision ? <DecisionLine decision={decision} /> : t("Every question is answered.")}
    </p>
  );
}
