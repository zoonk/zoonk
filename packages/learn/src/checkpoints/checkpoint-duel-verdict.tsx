"use client";

import { type DuelDecision } from "@zoonk/core/checkpoints/contract";
import { useExtracted } from "next-intl";
import { FeedbackExplanation, FeedbackPanel, FeedbackVerdict } from "../_components/feedback-panel";
import { useCheckpointScreen } from "./checkpoint-context";
import { getDuelScore } from "./checkpoint-duel-state";
import { getShieldCracks } from "./duel-ending";
import { TricksterArt } from "./trickster-art";

function DecisionLine({ decision }: { decision: DuelDecision }) {
  const t = useExtracted();

  return decision === "won"
    ? t("His shield is broken. You won!")
    : t("The Trickster won this time.");
}

/**
 * How the duel ended, drawn where the learner just answered. A computer plays it on the Trickster
 * in its side panel instead.
 */
function DuelEnding({ decision }: { decision: DuelDecision }) {
  const { checkpoint, duel } = useCheckpointScreen();
  const { correct } = getDuelScore({ checkpoint, state: duel.state });

  return (
    <div className="with-aside:hidden flex">
      <TricksterArt
        className="size-36 sm:size-36"
        cracks={getShieldCracks({ broken: correct, segments: checkpoint.passMark })}
        outcome={decision}
        reacts
      />
    </div>
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

      {decision && <DuelEnding decision={decision} />}
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
    <p className="text-foreground text-reading leading-6 text-pretty" role="status">
      {decision ? <DecisionLine decision={decision} /> : t("Every question is answered.")}
    </p>
  );
}
