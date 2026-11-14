"use client";

import { useExtracted, useFormatter } from "next-intl";
import { useShortList } from "../plan/use-short-list";
import { type StudyBlock } from "./session-types";
import { useReviewTitle } from "./use-review-title";

type BlockCopyInput = Pick<
  StudyBlock,
  | "areas"
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
  | "topics"
  | "weakest"
>;

/** A challenge's row has one name, from what the learner does in it. */
function useCheckpointTitle() {
  const t = useExtracted();

  return ({ checkpoint, questions }: Pick<BlockCopyInput, "checkpoint" | "questions">): string => {
    if (checkpoint?.mock) {
      return t("Mock exam");
    }

    if (checkpoint?.kind === "weekly") {
      return t("Weekly challenge");
    }

    // A language plan's challenge is a live call, with no questions.
    if (questions === 0) {
      return t({
        description: "The name of a study step: a live voice call in the language being learned.",
        message: "Call",
      });
    }

    return checkpoint?.rematch
      ? t({
          description: "The name of a study step: a second go at the Trickster's questions.",
          message: "Rematch",
        })
      : t("The Trickster");
  };
}

export function hasCapsules(block: Pick<StudyBlock, "capsules" | "kind">): boolean {
  return block.kind === "review" && block.capsules.length > 0;
}

export function practisesTopics(
  block: Pick<BlockCopyInput, "fullReview" | "kind" | "mistakesOnly" | "topics">,
): boolean {
  return (
    block.kind === "practice" && block.topics.length > 0 && !block.fullReview && !block.mistakesOnly
  );
}

export function useBlockTitle() {
  const t = useExtracted();
  const format = useFormatter();
  const checkpointTitle = useCheckpointTitle();
  const reviewTitle = useReviewTitle();

  return (block: BlockCopyInput): string => {
    if (block.checkpoint) {
      return checkpointTitle(block);
    }

    // The first week's warm-up is only placement's questions: it checks, it doesn't review.
    if (block.kind === "review" && !hasCapsules(block)) {
      return t("What you already know");
    }

    if (block.kind === "review" || block.fullReview) {
      return reviewTitle();
    }

    if (block.kind === "learn") {
      return block.title ?? t("New lesson");
    }

    if (block.kind === "produce") {
      return block.title ?? t("Writing practice");
    }

    if (block.mistakesOnly) {
      return t("Practice mistakes");
    }

    if (block.areas.length > 0) {
      const areas = format.list(block.areas, { type: "conjunction" });

      return block.extra
        ? t({
            description:
              'Extra practice the learner added. {areas} names the one or two subjects most of its questions are on, like "Math and Languages".',
            message: "Bonus practice: {areas}",
            values: { areas },
          })
        : t({
            description:
              'A block of the day\'s practice. {areas} names the one or two subjects most of its questions are on, like "Math and Languages".',
            message: "Practice: {areas}",
            values: { areas },
          });
    }

    return block.extra ? t("Bonus practice") : t("Mixed practice");
  };
}

export function useBlockDetail() {
  const t = useExtracted();
  const shortList = useShortList();

  function describe(block: BlockCopyInput & Pick<StudyBlock, "canDo">): string | null {
    if (hasCapsules(block) && block.weakest) {
      return t(
        "{count, plural, one {# question on what's been hardest for you} other {# questions on what's been hardest for you}}",
        { count: block.questions },
      );
    }

    if (hasCapsules(block)) {
      return t("{count, plural, one {# question} other {# questions}} · {titles}", {
        count: block.questions,
        titles: shortList(
          block.capsules.map((capsule) => capsule.title),
          "topics",
        ),
      });
    }

    if (block.kind === "learn") {
      return block.reinforcement ? t("Short lesson before the rematch") : block.canDo;
    }

    if (block.kind === "produce") {
      return block.canDo;
    }

    // A call has no questions to count, and its name says what it is.
    if (block.questions === 0) {
      return null;
    }

    if (block.fullReview) {
      return t(
        "{count, plural, one {# question on every topic} other {# questions on every topic}}",
        { count: block.questions },
      );
    }

    if (practisesTopics(block)) {
      return t("{count, plural, one {# question} other {# questions}} · {titles}", {
        count: block.questions,
        titles: shortList(block.topics, "topics", { named: 2 }),
      });
    }

    return t("{count, plural, one {# question} other {# questions}}", { count: block.questions });
  }

  return describe;
}
