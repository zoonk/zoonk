"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type PlayerRoute, usePlayerMilestone } from "../player-context";
import { PlayerLink } from "../player-link";
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

  const activeMilestone = milestone;

  function getLabel() {
    if (activeMilestone.kind === "course") {
      return t("Review Course");
    }

    return t("Review Chapter");
  }

  return <span>{getLabel()}</span>;
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

export function UnauthenticatedMilestoneActions({ loginHref }: { loginHref: PlayerRoute }) {
  const t = useExtracted();
  const milestone = usePlayerMilestone();

  if (!milestone) {
    return null;
  }

  return (
    <>
      <p className="text-muted-foreground text-sm">{t("Sign up to track your progress")}</p>

      <div className="flex w-full flex-col gap-3" data-slot="completion-actions">
        <PlayerLink className={cn(buttonVariants(), "w-full")} href={loginHref}>
          {t("Login")}
        </PlayerLink>

        <SecondaryActionLink href={milestone.reviewHref} shortcut="Esc">
          <ReviewLabel />
        </SecondaryActionLink>
      </div>
    </>
  );
}
