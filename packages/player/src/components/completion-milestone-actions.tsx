"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { Kbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { type Route } from "next";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { usePlayer } from "../player-context";

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
      <Link
        className={cn(buttonVariants({ size: "lg" }), "w-full lg:justify-between")}
        href={courseHref}
      >
        {t("Review Course")}
        <Kbd className="bg-primary-foreground/15 text-primary-foreground hidden opacity-70 lg:inline-flex">
          Enter
        </Kbd>
      </Link>

      <Link
        className={cn(buttonVariants({ variant: "outline" }), "w-full lg:justify-between")}
        href={chapterHref ?? lessonHref}
      >
        {t("Review Chapter")}
        <Kbd className="hidden opacity-60 lg:inline-flex">Esc</Kbd>
      </Link>
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
        <Link
          className={cn(buttonVariants({ size: "lg" }), "w-full lg:justify-between")}
          href={nextHref}
        >
          <NextButtonLabel />
          <Kbd className="bg-primary-foreground/15 text-primary-foreground hidden opacity-70 lg:inline-flex">
            Enter
          </Kbd>
        </Link>

        <Link
          className={cn(buttonVariants({ variant: "outline" }), "w-full lg:justify-between")}
          href={reviewHref}
        >
          <ReviewLabel />
          <Kbd className="hidden opacity-60 lg:inline-flex">Esc</Kbd>
        </Link>
      </>
    );
  }

  return (
    <Link
      className={cn(buttonVariants({ size: "lg" }), "w-full lg:justify-between")}
      href={reviewHref}
    >
      <ReviewLabel />
      <Kbd className="bg-primary-foreground/15 text-primary-foreground hidden opacity-70 lg:inline-flex">
        Esc
      </Kbd>
    </Link>
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

        <Link
          className={cn(buttonVariants({ variant: "outline" }), "w-full lg:justify-between")}
          href={getReviewHref()}
        >
          <ReviewLabel />
          <Kbd className="hidden opacity-60 lg:inline-flex">Esc</Kbd>
        </Link>
      </div>
    </>
  );
}
