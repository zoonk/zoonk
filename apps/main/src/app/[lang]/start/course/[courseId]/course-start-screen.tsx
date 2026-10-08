"use client";

import { startCourseFormAction } from "@/app/[lang]/start/course-start-actions";
import { CourseStartFailureNote } from "@/components/public/course-start-failure";
import { type CourseStartFailure, useCourseStart } from "@/components/public/use-course-start";
import { CHAPTER_PARAM } from "@/lib/public/public-hrefs";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingFrame,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingTitle,
} from "@zoonk/learn/onboarding/frame";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { Loader2Icon } from "lucide-react";
import { useExtracted } from "next-intl";

type StartTarget = {
  chapter: { id: string; title: string } | null;
  course: { id: string; title: string };
};

/** A chapter the plan will teach, in the course's order. */
type PlanChapter = { id: string; lessons: number; title: string };

/** Enough of the plan's chapters to see where it goes, without listing a whole course. */
const PREVIEW_CHAPTERS = 4;

const PLAN_PREVIEW_ID = "course-start-plan";

/**
 * What the plan will teach, from where it starts: the chapter and lesson counts and its first
 * chapters. A course nobody outlined yet says its chapters come when the learner starts.
 */
function PlanPreview({ chapters }: { chapters: PlanChapter[] }) {
  const t = useExtracted();

  if (chapters.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-pretty">
        {t("Its chapters and lessons are written when you start.")}
      </p>
    );
  }

  const lessons = chapters.reduce((total, chapter) => total + chapter.lessons, 0);
  const more = chapters.length - PREVIEW_CHAPTERS;

  return (
    <section
      aria-labelledby={PLAN_PREVIEW_ID}
      className="bg-card ring-foreground/10 rounded-3xl p-4 ring-1 sm:p-5"
    >
      <h2 className="text-muted-foreground text-sm font-medium" id={PLAN_PREVIEW_ID}>
        {t(
          "{chapters, plural, one {# chapter} other {# chapters}} · {lessons, plural, one {# lesson} other {# lessons}}",
          { chapters: chapters.length, lessons },
        )}
      </h2>

      <ol className="mt-3 flex flex-col gap-2.5">
        {chapters.slice(0, PREVIEW_CHAPTERS).map((chapter, index) => (
          <li className="flex items-start gap-3 text-[15px] leading-6" key={chapter.id}>
            <span className="flex h-6 shrink-0 items-center">
              <span className="bg-muted text-muted-foreground flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums">
                {index + 1}
              </span>
            </span>
            <span className="min-w-0 text-pretty">{chapter.title}</span>
          </li>
        ))}
      </ol>

      {more > 0 && (
        <p className="text-muted-foreground mt-2.5 pl-9 text-sm">
          {t("{count, plural, one {and # more chapter} other {and # more chapters}}", {
            count: more,
          })}
        </p>
      )}
    </section>
  );
}

function StartHeading({ chapter, course }: StartTarget) {
  const t = useExtracted();

  if (chapter) {
    return (
      <OnboardingHeading>
        <p className="text-muted-foreground text-sm font-medium">{course.title}</p>
        <OnboardingTitle>{chapter.title}</OnboardingTitle>
        <OnboardingDescription>
          {t(
            "Your plan starts at this chapter and follows the course from there, in the time you have each day.",
          )}
        </OnboardingDescription>
      </OnboardingHeading>
    );
  }

  return (
    <OnboardingHeading>
      <OnboardingTitle>{course.title}</OnboardingTitle>
      <OnboardingDescription>
        {t("Your plan follows this course, in the time you have each day.")}
      </OnboardingDescription>
    </OnboardingHeading>
  );
}

/**
 * The start button as a form the server answers when there's no JavaScript; with it, the tap
 * starts the course here and moves on, or says why it couldn't.
 */
function CourseStartForm({
  chapter,
  course,
  initialFailure,
}: StartTarget & { initialFailure: CourseStartFailure | null }) {
  const t = useExtracted();

  const { failure, pending, start } = useCourseStart({
    chapterId: chapter?.id,
    courseId: course.id,
    initialFailure,
  });

  return (
    <form
      action={startCourseFormAction}
      className="flex flex-col gap-3 [&:has([data-slot=start-failure])>[data-slot=start-note]]:hidden"
    >
      <input name="courseId" type="hidden" value={course.id} />
      {chapter && <input name={CHAPTER_PARAM} type="hidden" value={chapter.id} />}

      <OnboardingPrimaryButton
        disabled={pending}
        onClick={(event) => {
          event.preventDefault();
          start();
        }}
        type="submit"
      >
        {chapter ? t("Start the chapter") : t("Start this course")}
        {pending && <Loader2Icon aria-hidden="true" className="animate-spin" />}
      </OnboardingPrimaryButton>

      {pending && (
        <span className="sr-only" role="status">
          {t("Starting your plan…")}
        </span>
      )}

      <p className="text-muted-foreground text-center text-sm" data-slot="start-note">
        {t("Free to start. No account needed for your first lesson.")}
      </p>

      <CourseStartFailureNote
        actionClassName={cn(
          buttonVariants({ size: "lg", variant: "outline" }),
          "h-12 w-full text-base",
        )}
        className="max-w-none items-stretch text-center"
        failure={failure}
        onRetry={start}
      />
    </form>
  );
}

/**
 * A course's start page, where a link or a visitor without JavaScript lands: what the plan will
 * follow and one button. The button starts the course from the tap (as a guest when there's no
 * session). Opening the page starts nothing.
 */
export function CourseStartScreen({
  chapter,
  chapters,
  course,
  initialFailure,
}: StartTarget & { chapters: PlanChapter[]; initialFailure: CourseStartFailure | null }) {
  return (
    <OnboardingFrame>
      <OnboardingColumn className="sm:pt-16">
        <StartHeading chapter={chapter} course={course} />
        <PlanPreview chapters={chapters} />

        <OnboardingFooter>
          <CourseStartForm chapter={chapter} course={course} initialFailure={initialFailure} />
        </OnboardingFooter>
      </OnboardingColumn>
    </OnboardingFrame>
  );
}
