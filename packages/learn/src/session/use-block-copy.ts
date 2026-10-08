"use client";

import { useExtracted } from "next-intl";
import { type StudyBlock } from "./session-types";

type BlockCopyInput = Pick<
  StudyBlock,
  | "capsules"
  | "checkpoint"
  | "extra"
  | "fullReview"
  | "kind"
  | "questions"
  | "reinforcement"
  | "title"
>;

/** What a checkpoint is called. */
function useCheckpointTitle() {
  const t = useExtracted();

  return (checkpoint: NonNullable<StudyBlock["checkpoint"]>): string => {
    if (checkpoint.kind === "weekly") {
      if (checkpoint.mock) {
        return t("Mock exam");
      }

      return t("Weekly challenge");
    }

    if (checkpoint.kind === "finalBoss") {
      return t("Final challenge");
    }

    if (checkpoint.rematch) {
      return t("Challenge, second try");
    }

    return t("Phase challenge");
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
 * for the rest ("Quick review", "Mixed practice", or "What you already know" for placement's
 * questions in the first week).
 */
export function useBlockTitle() {
  const t = useExtracted();
  const checkpointTitle = useCheckpointTitle();

  return (block: BlockCopyInput): string => {
    if (block.checkpoint) {
      return checkpointTitle(block.checkpoint);
    }

    // The first week's warm-up is only placement's questions: it checks, it doesn't review.
    if (block.kind === "review") {
      return hasCapsules(block) ? t("Quick review") : t("What you already know");
    }

    if (block.kind === "learn") {
      return block.title ?? t("New lesson");
    }

    if (block.kind === "produce") {
      return block.title ?? t("Writing practice");
    }

    if (block.fullReview) {
      return t("Full review");
    }

    return block.extra ? t("Bonus practice") : t("Mixed practice");
  };
}

/** The line under a block's name: what's inside it, in a few words. */
export function useBlockDetail() {
  const t = useExtracted();

  return (block: BlockCopyInput & Pick<StudyBlock, "canDo">): string | null => {
    // In plain words: how many questions and on what, never "capsules".
    if (hasCapsules(block)) {
      const titles = block.capsules.map((capsule) => capsule.title).join(", ");

      return t("{count, plural, one {# question} other {# questions}} · {titles}", {
        count: block.questions,
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

    // A piece of writing is one prompt, which its name already says: "1 question" would add
    // nothing.
    if (block.kind === "produce") {
      return block.canDo;
    }

    if (block.fullReview) {
      return t(
        "{count, plural, one {# question} other {# questions}} on every topic, your weakest first",
        { count: block.questions },
      );
    }

    return t("{count, plural, one {# question} other {# questions}}", { count: block.questions });
  };
}
