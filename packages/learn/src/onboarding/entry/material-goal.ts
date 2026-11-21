"use client";

import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { type AttachedSource, type SentMaterial } from "../onboarding-actions";
import { type MaterialIntent } from "./material-intent";

type DraftMaterial = Pick<OnboardingDraftView, "materialIntent" | "sources">;

/** "Ask questions" starts no goal, so only the other choices go with the material. */
export function toSentMaterial({
  attached,
  intent,
}: {
  attached: readonly AttachedSource[];
  intent: MaterialIntent | null;
}): SentMaterial {
  if (attached.length === 0) {
    return {};
  }

  const materialIntent = intent === "exam" || intent === "understand" ? intent : undefined;
  return { materialIntent, sourceIds: attached.map((source) => source.id) };
}

export function toDraftMaterial(draft: DraftMaterial): SentMaterial {
  return toSentMaterial({ attached: draft.sources, intent: draft.materialIntent });
}

/** What the learner attached on Start and chose to do with it; editing a draft brings back its own. */
export function useStartMaterial() {
  const [attached, setAttached] = useState<AttachedSource[]>([]);
  const [intent, setIntent] = useState<MaterialIntent | null>(null);

  const restore = (draft: DraftMaterial) => {
    setAttached(draft.sources);
    setIntent(draft.materialIntent);
  };

  return { attached, intent, restore, setAttached, setIntent };
}

function useMaterialGoal() {
  const t = useExtracted();

  return ({ attached, intent }: { attached: AttachedSource[]; intent: MaterialIntent | null }) => {
    const titles = attached.map((source) => source.title || t("my notes")).join(", ");

    return intent === "exam"
      ? t({
          description:
            "The learner's goal, in their words: studying for an exam, not writing one. {titles} lists the titles of their study material.",
          message: "Prepare for an exam on my material: {titles}",
          values: { titles },
        })
      : t("Understand my material: {titles}", { titles });
  };
}

export function useSubmitGoal({
  material: { attached, intent },
  onAsk,
  understand,
}: {
  material: { attached: AttachedSource[]; intent: MaterialIntent | null };
  onAsk: () => void;
  understand: (goal: string, material: SentMaterial) => void;
}) {
  const materialGoal = useMaterialGoal();

  return (typed: string) => {
    const withMaterial = attached.length > 0 ? intent : null;

    if (withMaterial === "questions") {
      onAsk();
      return;
    }

    understand(
      typed || materialGoal({ attached, intent: withMaterial }),
      toSentMaterial({ attached, intent: withMaterial }),
    );
  };
}
