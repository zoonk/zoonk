"use client";

import { useExtracted } from "next-intl";
import { useShortList } from "../plan/use-short-list";
import { type StudyBlock } from "./session-types";
import { useReviewTitle } from "./use-review-title";

type BlockCopyInput = Pick<
  StudyBlock,
  | "capsules"
  | "checkpoint"
  | "estimatedMinutes"
  | "extra"
  | "fullReview"
  | "kind"
  | "mistakesOnly"
  | "questions"
  | "reinforcement"
  | "title"
  | "weakest"
>;

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

export function getChallengePhase(block: Pick<StudyBlock, "checkpoint" | "title">): string | null {
  return block.checkpoint && block.checkpoint.kind !== "weekly" && block.title ? block.title : null;
}

function hasCapsules(block: Pick<StudyBlock, "capsules" | "kind">): boolean {
  return block.kind === "review" && block.capsules.length > 0;
}

export function useBlockTitle() {
  const t = useExtracted();
  const checkpointTitle = useCheckpointTitle();
  const reviewTitle = useReviewTitle();

  return (block: BlockCopyInput): string => {
    if (block.checkpoint) {
      return checkpointTitle(block.checkpoint);
    }

    // The first week's warm-up is only placement's questions: it checks, it doesn't review.
    if (block.kind === "review" && !hasCapsules(block)) {
      return t("What you already know");
    }

    if (block.kind === "review") {
      return reviewTitle(block.estimatedMinutes);
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

    if (block.mistakesOnly) {
      return t("Practice mistakes");
    }

    return block.extra ? t("Bonus practice") : t("Mixed practice");
  };
}

export function useBlockDetail() {
  const t = useExtracted();
  const shortList = useShortList();

  return (block: BlockCopyInput & Pick<StudyBlock, "canDo">): string | null => {
    // Nothing was due, so the day reviews the weakest topics: never called due.
    if (hasCapsules(block) && block.weakest) {
      return t(
        "No reviews due today · {count, plural, one {# question} other {# questions}} on your weakest topics",
        { count: block.questions },
      );
    }

    if (hasCapsules(block)) {
      const titles = shortList(
        block.capsules.map((capsule) => capsule.title),
        "topics",
      );

      const reviewed = block.capsules.reduce((sum, capsule) => sum + capsule.questions, 0);

      return block.questions > reviewed
        ? t(
            "{count, plural, one {# question} other {# questions}} · {titles}, plus what you already know",
            { count: block.questions, titles },
          )
        : t("{count, plural, one {# question} other {# questions}} · {titles}", {
            count: block.questions,
            titles,
          });
    }

    if (block.kind === "learn") {
      return block.reinforcement ? t("Short lesson before the rematch") : block.canDo;
    }

    const phase = getChallengePhase(block);

    // A language unit's challenge is a live call, with no questions.
    if (block.checkpoint && !block.checkpoint.mock && block.questions === 0) {
      return phase ? t("{phase} · a live call", { phase }) : t("A live call");
    }

    if (phase) {
      return t("{phase} · {count, plural, one {# question} other {# questions}}, no hints", {
        count: block.questions,
        phase,
      });
    }

    if (block.checkpoint) {
      return t("{count, plural, one {# question} other {# questions}}, no hints", {
        count: block.questions,
      });
    }

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
