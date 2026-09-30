"use client";

import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ModePicker } from "../../appearance/mode-picker";
import { BUDDY_KINDS } from "../../buddies/buddy-labels";
import { type BuddyChoice, BuddyPicker } from "../../buddies/buddy-picker";
import { type ExperienceMode } from "../../experience-mode";
import { useLearnAnalytics } from "../../learn-context";
import { useExperienceMode } from "../../mode-provider";
import { StepForm } from "./step-form";

/** A new buddy is a baby with half its Energy, the same as on day 1. */
const NEW_BUDDY_LOOK = { beltColor: "white" as const, energy: 50 };

/** The modes in the order the picker shows them, so 1 is Focus and 2 is Fun. */
const MODES: ExperienceMode[] = ["focus", "fun"];

/**
 * Focus or Fun, like choosing light or dark. The current look comes preselected (Focus for a new
 * visitor), so one tap continues; the buddy only comes up after picking Fun.
 */
export function ModeStep({
  onAnswer,
  pending,
}: {
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
}) {
  const t = useExtracted();
  const analytics = useLearnAnalytics();
  const current = useExperienceMode();
  const [mode, setMode] = useState<ExperienceMode>(current);

  // As on every onboarding list, number keys pick and Enter continues.
  useNumberKeys({
    count: MODES.length,
    onPick: (index) => {
      const picked = MODES[index];

      if (picked) {
        setMode(picked);
      }
    },
  });

  return (
    <StepForm
      description={t("The method is the same. Only the look changes. You can switch anytime.")}
      onContinue={() => {
        analytics.track({ name: "Mode Chosen", properties: { chosen_mode: mode } });
        onAnswer({ experienceMode: mode, question: "mode" });
      }}
      pending={pending}
      title={t("How do you like to study?")}
    >
      <ModePicker mode={mode} onChange={setMode} />
    </StepForm>
  );
}

/** Fun's first moment: a buddy to feed by learning, with the learner's own name for it. */
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
      description={t("You feed your buddy by learning. It grows with you and never gets sick.")}
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
