"use client";

import { useExtracted } from "next-intl";
import { usePlayerMilestone } from "../player-context";
import { PrimaryActionLink, SecondaryActionLink } from "./completion-action-link";

function NextButtonLabel() {
  const t = useExtracted();
  const milestone = usePlayerMilestone();

  return <span>{milestone?.kind === "chapter" ? t("Next Chapter") : t("Next")}</span>;
}

function ReviewLabel() {
  const t = useExtracted();
  const milestone = usePlayerMilestone();

  if (!milestone) {
    return null;
  }

  const milestoneLabel = milestone.kind === "course" ? t("Review Course") : t("Review Chapter");

  return <span>{milestoneLabel}</span>;
}

function CourseCompleteActions() {
  const t = useExtracted();
  const milestone = usePlayerMilestone();

  if (!milestone || milestone.kind !== "course") {
    return null;
  }

  return (
    <>
      <PrimaryActionLink href={milestone.reviewHref} shortcut="Enter">
        {t("Review Course")}
      </PrimaryActionLink>

      <SecondaryActionLink href={milestone.secondaryReviewHref} shortcut="Esc">
        {t("Review Chapter")}
      </SecondaryActionLink>
    </>
  );
}

export function MilestoneActions() {
  const milestone = usePlayerMilestone();

  if (!milestone) {
    return null;
  }

  if (milestone.kind === "course") {
    return <CourseCompleteActions />;
  }

  if (milestone.nextHref) {
    return (
      <>
        <PrimaryActionLink href={milestone.nextHref} shortcut="Enter">
          <NextButtonLabel />
        </PrimaryActionLink>

        <SecondaryActionLink href={milestone.reviewHref} shortcut="Esc">
          <ReviewLabel />
        </SecondaryActionLink>
      </>
    );
  }

  return (
    <PrimaryActionLink href={milestone.reviewHref} shortcut="Esc">
      <ReviewLabel />
    </PrimaryActionLink>
  );
}
