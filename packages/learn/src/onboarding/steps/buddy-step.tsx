"use client";

import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { BUDDY_KINDS } from "../../buddies/buddy-labels";
import { type BuddyChoice, BuddyPicker } from "../../buddies/buddy-picker";
import { useLearnAnalytics } from "../../learn-context";
import { StepForm } from "./step-form";

/** A new buddy is a baby with half its Energy, the same as on day 1. */
const NEW_BUDDY_LOOK = { beltColor: "white" as const, energy: 50 };

/** A buddy to feed by learning, with the learner's own name for it. */
export function BuddyStep({
  onAnswer,
  pending,
}: {
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
}) {
  const t = useExtracted();
  const analytics = useLearnAnalytics();
  const [choice, setChoice] = useState<BuddyChoice>({ glasses: "round", kind: "zu", name: "" });
  const name = choice.name.trim();

  useNumberKeys({
    count: BUDDY_KINDS.length,
    onPick: (index) => {
      const kind = BUDDY_KINDS[index];

      if (kind) {
        setChoice((current) => ({ ...current, kind }));
      }
    },
  });

  return (
    <StepForm
      description={t("You feed your buddy by learning. It grows with you.")}
      onContinue={() => {
        analytics.track({
          name: "Buddy Chosen",
          properties: { buddy: choice.kind, renamed: Boolean(name) },
        });

        onAnswer({ buddy: { kind: choice.kind, name: name || null }, question: "buddy" });
      }}
      pending={pending}
      title={t("Choose your buddy")}
    >
      <BuddyPicker choice={choice} look={NEW_BUDDY_LOOK} onChange={setChoice} />
    </StepForm>
  );
}
