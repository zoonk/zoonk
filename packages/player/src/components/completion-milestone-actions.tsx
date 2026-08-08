"use client";

import { useExtracted } from "next-intl";
import { usePlayerMilestone } from "../player-context";
import {
  PrimaryActionLink,
  SecondaryActionButton,
  SecondaryActionLink,
} from "./completion-action-link";

/**
 * Keeps lesson review inside the player. Going back to the chapter is a separate
 * navigation action, while this callback resets the completed lesson from its first step.
 */
function ReviewButton({ onRestart }: { onRestart: () => void }) {
  const t = useExtracted();

  return (
    <SecondaryActionButton onClick={onRestart} shortcut="R">
      {t("Review")}
    </SecondaryActionButton>
  );
}

/**
 * Course completion returns to the completed course with the same Escape
 * shortcut used for chapter completion, while review stays inside the player.
 */
function CourseCompleteActions({ onRestart }: { onRestart: () => void }) {
  const t = useExtracted();
  const milestone = usePlayerMilestone();

  if (!milestone || milestone.kind !== "course") {
    return null;
  }

  return (
    <>
      <PrimaryActionLink href={milestone.courseHref} shortcut="Esc">
        {t("Back to course")}
      </PrimaryActionLink>

      <ReviewButton onRestart={onRestart} />
    </>
  );
}

/**
 * Chapter completion prioritizes the learner's next chapter when one exists,
 * while keeping chapter navigation and lesson review as distinct actions.
 */
function ChapterCompleteActions({ onRestart }: { onRestart: () => void }) {
  const t = useExtracted();
  const milestone = usePlayerMilestone();

  if (!milestone || milestone.kind !== "chapter") {
    return null;
  }

  if (milestone.nextHref) {
    return (
      <>
        <PrimaryActionLink href={milestone.nextHref} shortcut="Enter">
          {t("Next Chapter")}
        </PrimaryActionLink>

        <SecondaryActionLink href={milestone.chapterHref} shortcut="Esc">
          {t("Back to chapter")}
        </SecondaryActionLink>

        <ReviewButton onRestart={onRestart} />
      </>
    );
  }

  return (
    <>
      <PrimaryActionLink href={milestone.chapterHref} shortcut="Esc">
        {t("Back to chapter")}
      </PrimaryActionLink>

      <ReviewButton onRestart={onRestart} />
    </>
  );
}

/**
 * Selects the structural completion actions while the caller supplies the same
 * restart behavior used by ordinary lesson completion.
 */
export function MilestoneActions({ onRestart }: { onRestart: () => void }) {
  const milestone = usePlayerMilestone();

  if (!milestone) {
    return null;
  }

  if (milestone.kind === "course") {
    return <CourseCompleteActions onRestart={onRestart} />;
  }

  return <ChapterCompleteActions onRestart={onRestart} />;
}
