"use client";

import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { useExtracted } from "next-intl";
import { type UnderstoodRow } from "./use-understood-rows";

type DraftMaterial = Pick<OnboardingDraftView, "materialMissing" | "sources">;

/** A file still being read counts: the plan waits for its reading. */
function isFollowed(source: DraftMaterial["sources"][number]): boolean {
  return source.readStatus !== "unreadable";
}

function useMaterialNote() {
  const t = useExtracted();

  return ({ materialMissing, sources }: DraftMaterial): string => {
    const followed = sources.filter((source) => isFollowed(source));
    const [onlyUnreadable, ...otherUnreadable] = sources.filter((source) => !isFollowed(source));

    if (!materialMissing && !onlyUnreadable) {
      return t("Your plan and lessons follow this material");
    }

    if (followed.length === 0) {
      return sources.length > 1
        ? t({
            description:
              "Under the learner's files on the goal card, when none of them could be read: nothing on them could be read, or they're gone.",
            message: "We couldn't read these files, so your plan won't follow them.",
          })
        : t({
            description:
              "Under the learner's material on the goal card, when none of it could be read: nothing on it could be read, or it's gone. \"It\" is that material.",
            message: "We couldn't read it, so your plan won't follow it.",
          });
    }

    if (onlyUnreadable && otherUnreadable.length === 0 && !materialMissing) {
      return t({
        description:
          'Under the learner\'s material on the goal card, when nothing could be read on one of their files. "This material" is what the row lists; {title} is the file it couldn\'t read, like "Notes.jpg".',
        message: "Your plan and lessons follow only this material. We couldn't read “{title}”.",
        values: { title: onlyUnreadable.title || t("Your text") },
      });
    }

    // Past the one-file note, a file it couldn't read means two or more weren't read.
    return onlyUnreadable
      ? t({
          description:
            'Under the learner\'s material on the goal card, when nothing could be read on several of their files. "This material" is what the row lists.',
          message:
            "Your plan and lessons follow only this material. We couldn't read the other files.",
        })
      : t({
          description:
            'Under the learner\'s material on the goal card, when some of it is gone. "This material" is what the row lists.',
          message: "Your plan and lessons follow only this material. We couldn't read the rest.",
        });
  };
}

export function useMaterialRow() {
  const t = useExtracted();
  const materialNote = useMaterialNote();

  return function toMaterialRow(material: DraftMaterial): UnderstoodRow | null {
    if (material.sources.length === 0 && !material.materialMissing) {
      return null;
    }

    const followed = material.sources.filter((source) => isFollowed(source));
    // With nothing readable, the files it couldn't read stay named, so the note has something to point at.
    const shown = followed.length > 0 ? followed : material.sources;

    return {
      id: "material",
      label: t("Your material"),
      note: materialNote(material),
      value: shown.map((source) => source.title || t("Your text")).join(", "),
    };
  };
}
