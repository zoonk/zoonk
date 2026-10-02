"use client";

import { useExtracted } from "next-intl";
import { useExperienceMode } from "../mode-provider";
import { type StudyBlock } from "./session-types";

type BlockCopyInput = Pick<
  StudyBlock,
  "capsules" | "checkpoint" | "extra" | "kind" | "questions" | "reinforcement" | "title"
>;

/** What a checkpoint is called: Fun names the boss, Focus names the checkpoint. */
function useCheckpointTitle() {
  const t = useExtracted();
  const mode = useExperienceMode();

  return (checkpoint: NonNullable<StudyBlock["checkpoint"]>): string => {
    if (checkpoint.kind === "weekly") {
      if (checkpoint.mock) {
        return t("Mock exam");
      }

      return mode === "fun" ? t("Big Challenge") : t("Weekly challenge");
    }

    if (checkpoint.kind === "finalBoss") {
      return mode === "fun" ? t("The final boss") : t("Final checkpoint");
    }

    if (checkpoint.rematch) {
      return mode === "fun" ? t("Rematch with the Trickster") : t("Checkpoint, second try");
    }

    return mode === "fun" ? t("Boss: the Trickster") : t("Phase checkpoint");
  };
}

/**
 * A review block's questions come in capsules, except the first week's warm-up, which is placement
 * questions only: it's named and counted as questions, never as "0 capsules".
 */
function hasCapsules(block: Pick<StudyBlock, "capsules" | "kind">): boolean {
  return block.kind === "review" && block.capsules.length > 0;
}

/**
 * A block's name on Today and in the session: the lesson's title for lessons, what the block is
 * for the rest ("Quick review" in Focus, "Capsules" in Fun when it has capsules).
 */
export function useBlockTitle() {
  const t = useExtracted();
  const mode = useExperienceMode();
  const checkpointTitle = useCheckpointTitle();

  return (block: BlockCopyInput): string => {
    if (block.checkpoint) {
      return checkpointTitle(block.checkpoint);
    }

    if (block.kind === "review") {
      return mode === "fun" && hasCapsules(block) ? t("Capsules") : t("Quick review");
    }

    if (block.kind === "learn") {
      return block.title ?? t("New lesson");
    }

    if (block.kind === "produce") {
      return block.title ?? t("Writing practice");
    }

    return block.extra ? t("Bonus practice") : t("Mixed practice");
  };
}

/** The line under a block's name: what's inside it, in a few words. */
export function useBlockDetail() {
  const t = useExtracted();

  return (block: BlockCopyInput & Pick<StudyBlock, "canDo">): string | null => {
    if (hasCapsules(block)) {
      const titles = block.capsules.map((capsule) => capsule.title).join(", ");

      return t("{count, plural, one {# capsule} other {# capsules}} · {titles}", {
        count: block.capsules.length,
        titles,
      });
    }

    if (block.kind === "learn") {
      return block.reinforcement ? t("Short lesson before the rematch") : block.canDo;
    }

    if (block.checkpoint) {
      return t("{count, plural, one {# question} other {# questions}}, no hints", {
        count: block.questions,
      });
    }

    return t("{count, plural, one {# question} other {# questions}}", { count: block.questions });
  };
}

/** Fun's small caps label over a stop: what kind of stop it is. */
export function useBlockKindLabel() {
  const t = useExtracted();

  return (block: Pick<StudyBlock, "capsules" | "checkpoint" | "kind">): string => {
    if (block.checkpoint) {
      return t("Checkpoint");
    }

    switch (block.kind) {
      case "review":
        return hasCapsules(block) ? t("Capsules") : t("Questions");
      case "learn":
        return t("Lesson + questions");
      case "produce":
        return t("Writing");
      case "checkpoint":
      case "practice":
        return t("Questions");
      default:
        return t("Questions");
    }
  };
}
