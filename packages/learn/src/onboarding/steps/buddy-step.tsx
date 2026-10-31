"use client";

import { DEFAULT_BUDDY } from "@zoonk/core/profile/default-buddy";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { BUDDY_KINDS } from "../../buddies/buddy-labels";
import { type BuddyChoice, BuddyPicker } from "../../buddies/buddy-picker";
import { useLearnAnalytics } from "../../learn-context";
import { StepForm } from "./step-form";

const NEW_BUDDY_LOOK = { beltColor: "white" as const, energy: 50 };

export function BuddyStep({
  onAnswer,
  pending,
}: {
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
}) {
  const t = useExtracted();
  const analytics = useLearnAnalytics();
  const [choice, setChoice] = useState<BuddyChoice>({ ...DEFAULT_BUDDY, name: "" });
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
      description={t("Your buddy grows as you learn.")}
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
