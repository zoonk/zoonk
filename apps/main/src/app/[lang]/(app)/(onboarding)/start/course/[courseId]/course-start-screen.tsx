"use client";

import { startCourseFormAction } from "@/app/[lang]/(app)/(onboarding)/start/course-start-actions";
import { CourseStartFailureNote, isStartBlocked } from "@/components/public/course-start-failure";
import { type CourseStartFailure, useCourseStart } from "@/components/public/use-course-start";
import { CHAPTER_PARAM, MINUTES_PARAM, PICKED_PARAM } from "@/lib/public/public-hrefs";
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
  /** The time a day the course's page showed, which the plan starts with; null for the default. */
  dailyMinutes: number | null;
  /** The visitor chose that time on the course's page, rather than leaving its first one. */
  minutesPicked: boolean;
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
    <section aria-labelledby={PLAN_PREVIEW_ID} className="flex flex-col gap-1">
      <h2 className="text-label" id={PLAN_PREVIEW_ID}>
        {t(
          "{chapters, plural, one {# chapter} other {# chapters}} · {lessons, plural, one {# lesson} other {# lessons}}",
          { chapters: chapters.length, lessons },
        )}
      </h2>

      <ol className="flex flex-col [&>li+li]:border-t">
        {chapters.slice(0, PREVIEW_CHAPTERS).map((chapter, index) => (
          <li className="flex items-start gap-3 py-2.5 text-sm leading-6" key={chapter.id}>
            <span className="text-faint w-4 shrink-0 font-mono text-xs leading-6 tabular-nums">
              {index + 1}
            </span>
            <span className="min-w-0 font-medium text-pretty">{chapter.title}</span>
          </li>
        ))}
      </ol>

      {more > 0 && (
        <p className="text-muted-foreground pl-7 text-sm">
          {t("{count, plural, one {and # more chapter} other {and # more chapters}}", {
            count: more,
          })}
        </p>
      )}
    </section>
  );
}

function StartHeading({
  asksLevel,
  chapter,
  course,
}: Omit<StartTarget, "dailyMinutes" | "minutesPicked"> & { asksLevel: boolean }) {
  const t = useExtracted();

  if (chapter) {
    return (
      <OnboardingHeading>
        <OnboardingSubject>{course.title}</OnboardingSubject>
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
  dailyMinutes,
  initialFailure,
  level,
  minutesPicked,
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
    dailyMinutes,
    initialFailure,
  });

  const startHere = () => (level ? startWithLevel(toLevelAnswer(level)) : start());
  // Only an account or Plus lets it go on: that's the page's one action, with nothing to answer.
  const blocked = isStartBlocked(failure);

  return (
    <form action={startCourseFormAction} className="flex flex-1 flex-col gap-6">
      {!blocked && dailyMinutes && (
        <p className="text-muted-foreground -mt-2 text-sm text-pretty">
          {minutesPicked
            ? t(
                "{minutes, plural, one {# minute} other {# minutes}} a day, as you picked. You can change it in the next steps.",
                { minutes: dailyMinutes },
              )
            : t(
                "{minutes, plural, one {# minute} other {# minutes}} a day for now. You can change it in the next steps.",
                { minutes: dailyMinutes },
              )}
        </p>
      )}

      {!blocked && children}

      <OnboardingFooter className="gap-3 [&:has([data-slot=start-failure])>[data-slot=start-note]]:hidden">
        <input name="courseId" type="hidden" value={course.id} />
        {chapter && <input name={CHAPTER_PARAM} type="hidden" value={chapter.id} />}
        {dailyMinutes && <input name={MINUTES_PARAM} type="hidden" value={dailyMinutes} />}
        {dailyMinutes && minutesPicked && <input name={PICKED_PARAM} type="hidden" value="1" />}

        {!blocked && (
          <OnboardingPrimaryButton
            disabled={pending || (isMounted && level === null)}
            onClick={(event) => {
              event.preventDefault();
              startHere();
            }}
            type="submit"
          >
            {t("Build my plan")}
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
            "w-full",
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
  dailyMinutes,
  initialFailure,
  minutesPicked,
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
      dailyMinutes={dailyMinutes}
      initialFailure={initialFailure}
      level={level}
      minutesPicked={minutesPicked}
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
  dailyMinutes,
  initialFailure,
  minutesPicked,
  note,
}: StartTarget & {
  chapters: PlanChapter[];
  initialFailure: CourseStartFailure | null;
  /** Under the button: free to start, said only to visitors and guests (see `NoAccountNote`). */
  note: React.ReactNode;
}) {
  return (
    <OnboardingFrame>
      <OnboardingColumn>
        <StartHeading
          asksLevel={!isStartBlocked(initialFailure)}
          chapter={chapter}
          course={course}
        />

        {chapter ? (
          <CourseStartForm
            chapter={chapter}
            course={course}
            dailyMinutes={dailyMinutes}
            initialFailure={initialFailure}
            minutesPicked={minutesPicked}
            note={note}
          >
            <PlanPreview chapters={chapters} />
          </CourseStartForm>
        ) : (
          <CourseLevelStart
            course={course}
            dailyMinutes={dailyMinutes}
            initialFailure={initialFailure}
            minutesPicked={minutesPicked}
            note={note}
          />
        )}
      </OnboardingColumn>
    </OnboardingFrame>
  );
}
