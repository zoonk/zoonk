"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type Route } from "next";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { usePlayer } from "../player-context";
import { PrimaryActionLink, SecondaryActionLink } from "./completion-action-link";

function NextButtonLabel() {
  const t = useExtracted();
  const { isNextChapter } = usePlayer();

  return <span>{isNextChapter ? t("Next Chapter") : t("Next Lesson")}</span>;
}

function ReviewLabel() {
  const t = useExtracted();
  const { isCourseComplete, isNextChapter } = usePlayer();

  function getLabel() {
    if (isCourseComplete) {
      return t("Review Course");
    }

    if (isNextChapter) {
      return t("Review Chapter");
    }

    return t("Review Lesson");
  }

  return <span>{getLabel()}</span>;
}

function CourseCompleteActions({ lessonHref }: { lessonHref: Route }) {
  const t = useExtracted();
  const { chapterHref, courseHref } = usePlayer();

  return (
    <>
      <PrimaryActionLink href={courseHref} shortcut="Enter">
        {t("Review Course")}
      </PrimaryActionLink>

      <SecondaryActionLink href={chapterHref ?? lessonHref} shortcut="Esc">
        {t("Review Chapter")}
      </SecondaryActionLink>
    </>
  );
}

export function MilestoneActions({ lessonHref }: { lessonHref: Route }) {
  const { chapterHref, isCourseComplete, isNextChapter, nextChapterHref, nextLessonHref } =
    usePlayer();

  if (isCourseComplete) {
    return <CourseCompleteActions lessonHref={lessonHref} />;
  }

  const nextHref = isNextChapter ? nextChapterHref : nextLessonHref;
  const reviewHref = isNextChapter ? chapterHref : lessonHref;

  if (nextHref) {
    return (
      <>
        <PrimaryActionLink href={nextHref} shortcut="Enter">
          <NextButtonLabel />
        </PrimaryActionLink>

        <SecondaryActionLink href={reviewHref} shortcut="Esc">
          <ReviewLabel />
        </SecondaryActionLink>
      </>
    );
  }

  return (
    <PrimaryActionLink href={reviewHref} shortcut="Esc">
      <ReviewLabel />
    </PrimaryActionLink>
  );
}

export function UnauthenticatedMilestoneActions({
  lessonHref,
  loginHref,
}: {
  lessonHref: Route;
  loginHref: Route;
}) {
  const t = useExtracted();
  const { chapterHref, courseHref, isCourseComplete, isNextChapter } = usePlayer();

  function getReviewHref() {
    if (isCourseComplete) {
      return courseHref;
    }
    if (isNextChapter) {
      return chapterHref;
    }
    return lessonHref;
  }

  return (
    <>
      <p className="text-muted-foreground text-sm">{t("Sign up to track your progress")}</p>

      <div className="flex w-full flex-col gap-3" data-slot="completion-actions">
        <Link className={cn(buttonVariants(), "w-full")} href={loginHref}>
          {t("Login")}
        </Link>

        <SecondaryActionLink href={getReviewHref()} shortcut="Esc">
          <ReviewLabel />
        </SecondaryActionLink>
      </div>
    </>
  );
}
