"use client";

import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { type AttachedSource, type SentMaterial } from "../onboarding-actions";
import { type MaterialIntent } from "./material-intent";

type DraftMaterial = Pick<OnboardingDraftView, "materialIntent" | "sources">;

/** "Ask questions" starts no goal, so only the other choices go with the material. */
function toSentMaterial({
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

function toDraftMaterial(draft: DraftMaterial): SentMaterial {
  return toSentMaterial({ attached: draft.sources, intent: draft.materialIntent });
}

/** Marked once a send was refused for it; adding it again brings an unmarked one. */
export type StartAttachment = AttachedSource & { unreadable?: boolean };

/** What the learner attached on Start and chose to do with it; editing a draft brings back its own. */
export function useStartMaterial() {
  const [attached, setAttached] = useState<StartAttachment[]>([]);
  const [intent, setIntent] = useState<MaterialIntent | null>(null);

  const restore = (draft: DraftMaterial) => {
    setAttached(draft.sources);
    setIntent(draft.materialIntent);
  };

  const markUnreadable = (sourceIds: readonly string[]) =>
    setAttached((current) =>
      current.map((source) => ({ ...source, unreadable: sourceIds.includes(source.id) })),
    );

  return { attached, intent, markUnreadable, restore, setAttached, setIntent };
}

export type StartMaterial = ReturnType<typeof useStartMaterial>;

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

/** A goal sent from Start with its material, or a draft's new words with the draft's. */
export function useSubmitGoal({
  material: { attached, intent, restore },
  onAsk,
  understand,
}: {
  material: Pick<StartMaterial, "attached" | "intent" | "restore">;
  onAsk: () => void;
  understand: (input: { goal: string; material: SentMaterial; words?: string }) => void;
}) {
  const materialGoal = useMaterialGoal();

  const submit = (typed: string) => {
    const withMaterial = attached.length > 0 ? intent : null;

    if (withMaterial === "questions") {
      onAsk();
      return;
    }

    understand({
      goal: typed || materialGoal({ attached, intent: withMaterial }),
      material: toSentMaterial({ attached, intent: withMaterial }),
      words: typed,
    });
  };

  /** The draft's material comes back on Start first, so a refused send returns to it. */
  const rewrite = ({ draft, goal }: { draft: DraftMaterial; goal: string }) => {
    restore(draft);
    understand({ goal, material: toDraftMaterial(draft) });
  };

  return { rewrite, submit };
}
