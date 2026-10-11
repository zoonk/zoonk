"use client";

import { startCourseFormAction } from "@/app/[lang]/start/course-start-actions";
import { CourseStartFailureNote, isStartBlocked } from "@/components/public/course-start-failure";
import { type CourseStartFailure, useCourseStart } from "@/components/public/use-course-start";
import { CHAPTER_PARAM } from "@/lib/public/public-hrefs";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFooter,
  OnboardingFrame,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSubject,
  OnboardingTitle,
} from "@zoonk/learn/onboarding/frame";
import {
  type LevelChoice,
  LevelChoiceList,
  toLevelAnswer,
} from "@zoonk/learn/onboarding/level-choices";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { cn } from "@zoonk/ui/lib/utils";
import { Loader2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";

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
 * What a chapter's plan will teach, from that chapter on: the chapter and lesson counts and its
 * first chapters.
 */
function PlanPreview({ chapters }: { chapters: PlanChapter[] }) {
  const t = useExtracted();
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

function StartHeading({ asksLevel, chapter, course }: StartTarget & { asksLevel: boolean }) {
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

  // A whole course asks where the learner stands before anything is created.
  if (asksLevel) {
    return (
      <OnboardingHeading>
        <OnboardingSubject>{course.title}</OnboardingSubject>
        <OnboardingTitle>{t("How much do you already know?")}</OnboardingTitle>
        <OnboardingDescription>
          {t("It only changes where your plan starts.")}
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
 * starts the course here and moves on, or says why it couldn't. A whole course's start waits for
 * the learner's level (`children` asks it); without JavaScript it starts without one, and
 * onboarding asks it.
 */
function CourseStartForm({
  children,
  chapter,
  course,
  initialFailure,
  level,
  note,
}: StartTarget & {
  children: React.ReactNode;
  initialFailure: CourseStartFailure | null;
  /** The level picked on a whole course's start; undefined when a chapter's start doesn't ask. */
  level?: LevelChoice | null;
  note: React.ReactNode;
}) {
  const t = useExtracted();
  const isMounted = useIsMounted();

  const { failure, pending, start, startWithLevel } = useCourseStart({
    chapterId: chapter?.id,
    courseId: course.id,
    initialFailure,
  });

  const startHere = () => (level ? startWithLevel(toLevelAnswer(level)) : start());
  // Only an account or Plus lets it go on: that's the page's one action, with nothing to answer.
  const blocked = isStartBlocked(failure);

  return (
    <form action={startCourseFormAction} className="flex flex-1 flex-col gap-6">
      {!blocked && children}

      <OnboardingFooter className="gap-3 [&:has([data-slot=start-failure])>[data-slot=start-note]]:hidden">
        <input name="courseId" type="hidden" value={course.id} />
        {chapter && <input name={CHAPTER_PARAM} type="hidden" value={chapter.id} />}

        {!blocked && (
          <OnboardingPrimaryButton
            disabled={pending || (isMounted && level === null)}
            onClick={(event) => {
              event.preventDefault();
              startHere();
            }}
            type="submit"
          >
            {chapter ? t("Start the chapter") : t("Start this course")}
            {pending && <Loader2Icon aria-hidden="true" className="animate-spin" />}
          </OnboardingPrimaryButton>
        )}

        {pending && (
          <span className="sr-only" role="status">
            {t("Starting your plan…")}
          </span>
        )}

        {note}

        <CourseStartFailureNote
          actionClassName={cn(
            buttonVariants({ size: "lg", variant: blocked ? "default" : "outline" }),
            "h-12 w-full text-base",
          )}
          className="max-w-none items-stretch text-center"
          failure={failure}
          onRetry={startHere}
        />
      </OnboardingFooter>
    </form>
  );
}

/** A whole course's start: the learner's level first, and Start creates the goal with it. */
function CourseLevelStart({
  course,
  initialFailure,
  note,
}: Omit<StartTarget, "chapter"> & {
  initialFailure: CourseStartFailure | null;
  note: React.ReactNode;
}) {
  const [level, setLevel] = useState<LevelChoice | null>(null);

  return (
    <CourseStartForm
      chapter={null}
      course={course}
      initialFailure={initialFailure}
      level={level}
      note={note}
    >
      <LevelChoiceList onChange={setLevel} value={level} />
    </CourseStartForm>
  );
}

/**
 * A course's start page, where every start of a whole course goes (its page's button, "Build my
 * plan", "I want to learn this in depth"), a link or a visitor without JavaScript lands: the
 * learner's level, or for a chapter what the plan will follow, and one button. The button starts
 * the course from the tap (as a guest when there's no session). Opening or leaving the page
 * creates nothing. A goal limit only an account or Plus lifts is said up front, as its one action.
 */
export function CourseStartScreen({
  chapter,
  chapters,
  course,
  initialFailure,
  note,
}: StartTarget & {
  chapters: PlanChapter[];
  initialFailure: CourseStartFailure | null;
  /** Under the button: free to start, said only to visitors and guests (see `NoAccountNote`). */
  note: React.ReactNode;
}) {
  return (
    <OnboardingFrame>
      <OnboardingColumn className="sm:pt-16">
        <StartHeading
          asksLevel={!isStartBlocked(initialFailure)}
          chapter={chapter}
          course={course}
        />

        {chapter ? (
          <CourseStartForm
            chapter={chapter}
            course={course}
            initialFailure={initialFailure}
            note={note}
          >
            <PlanPreview chapters={chapters} />
          </CourseStartForm>
        ) : (
          <CourseLevelStart course={course} initialFailure={initialFailure} note={note} />
        )}
      </OnboardingColumn>
    </OnboardingFrame>
  );
}
