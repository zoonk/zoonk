"use client";

import { startCourseFormAction } from "@/app/[lang]/(app)/(onboarding)/start/course-start-actions";
import { CourseStartFailureNote } from "@/components/public/course-start-failure";
import { isStartBlocked } from "@/components/public/course-start-remedy";
import { type CourseStartFailure, useCourseStart } from "@/components/public/use-course-start";
import { CHAPTER_PARAM, MINUTES_PARAM } from "@/lib/public/public-hrefs";
import {
  ONBOARDING_ACTION_LINK_CLASS,
  OnboardingActions,
  OnboardingColumn,
  OnboardingDescription,
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
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";

type StartTarget = {
  chapter: { id: string; title: string } | null;
  course: { id: string; quickTestMinutes: number; title: string };
  dailyMinutes: number | null;
};

type PlanChapter = { id: string; lessons: number; title: string };

const PREVIEW_CHAPTERS = 4;

const PLAN_PREVIEW_ID = "course-start-plan";

function PlanPreview({ chapters }: { chapters: PlanChapter[] }) {
  const t = useExtracted();
  const lessons = chapters.reduce((total, chapter) => total + chapter.lessons, 0);
  const more = chapters.length - PREVIEW_CHAPTERS;

  return (
    <section aria-labelledby={PLAN_PREVIEW_ID} className="flex flex-col gap-1">
      <h2
        className="text-muted-foreground font-mono text-xs leading-5 tabular-nums"
        id={PLAN_PREVIEW_ID}
      >
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
}: Omit<StartTarget, "dailyMinutes"> & { asksLevel: boolean }) {
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

  if (asksLevel) {
    return (
      <OnboardingHeading>
        <OnboardingSubject>{course.title}</OnboardingSubject>
        <OnboardingTitle>{t("How much do you already know?")}</OnboardingTitle>
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

/** Without JavaScript the form starts a whole course without a level, and onboarding asks it. */
function CourseStartForm({
  children,
  chapter,
  course,
  dailyMinutes,
  initialFailure,
  level,
  note,
}: StartTarget & {
  children: React.ReactNode;
  initialFailure: CourseStartFailure | null;
  level?: LevelChoice | null;
  note: React.ReactNode;
}) {
  const t = useExtracted();
  const formId = useId();
  const isMounted = useIsMounted();

  const { failure, pending, start, startWithLevel } = useCourseStart({
    chapterId: chapter?.id,
    courseId: course.id,
    dailyMinutes,
    initialFailure,
  });

  const startHere = () => (level ? startWithLevel(toLevelAnswer(level)) : start());
  const blocked = isStartBlocked(failure);

  return (
    <OnboardingColumn
      bar={
        <OnboardingActions
          note={
            failure ? (
              <CourseStartFailureNote
                actionClassName={ONBOARDING_ACTION_LINK_CLASS[blocked ? "main" : "other"]}
                className="w-full max-w-none items-stretch lg:items-end"
                failure={failure}
                onRetry={startHere}
                secondaryActionClassName={ONBOARDING_ACTION_LINK_CLASS.other}
              />
            ) : (
              note
            )
          }
        >
          {!blocked && (
            <OnboardingPrimaryButton
              busy={pending}
              disabled={isMounted && level === null}
              form={formId}
              onClick={(event) => {
                event.preventDefault();
                startHere();
              }}
              type="submit"
            >
              {t("Build my plan")}
            </OnboardingPrimaryButton>
          )}
        </OnboardingActions>
      }
    >
      <StartHeading asksLevel={!isStartBlocked(initialFailure)} chapter={chapter} course={course} />

      <form action={startCourseFormAction} className="flex flex-1 flex-col gap-6" id={formId}>
        <input name="courseId" type="hidden" value={course.id} />
        {chapter && <input name={CHAPTER_PARAM} type="hidden" value={chapter.id} />}
        {dailyMinutes && <input name={MINUTES_PARAM} type="hidden" value={dailyMinutes} />}

        {!blocked && dailyMinutes && (
          <p className="text-muted-foreground -mt-2 text-sm text-pretty">
            {t(
              "{minutes, plural, one {# minute} other {# minutes}} a day. You can change it later.",
              { minutes: dailyMinutes },
            )}
          </p>
        )}

        {!blocked && children}

        {pending && (
          <span className="sr-only" role="status">
            {t("Starting your plan…")}
          </span>
        )}
      </form>
    </OnboardingColumn>
  );
}

function CourseLevelStart({
  course,
  dailyMinutes,
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
      dailyMinutes={dailyMinutes}
      initialFailure={initialFailure}
      level={level}
      note={note}
    >
      <LevelChoiceList onChange={setLevel} testMinutes={course.quickTestMinutes} value={level} />
    </CourseStartForm>
  );
}

/** Opening or leaving the page creates nothing; only the button's tap starts the course. */
export function CourseStartScreen({
  chapter,
  chapters,
  course,
  dailyMinutes,
  initialFailure,
  note,
}: StartTarget & {
  chapters: PlanChapter[];
  initialFailure: CourseStartFailure | null;
  note: React.ReactNode;
}) {
  return (
    <OnboardingFrame>
      {chapter ? (
        <CourseStartForm
          chapter={chapter}
          course={course}
          dailyMinutes={dailyMinutes}
          initialFailure={initialFailure}
          note={note}
        >
          <PlanPreview chapters={chapters} />
        </CourseStartForm>
      ) : (
        <CourseLevelStart
          course={course}
          dailyMinutes={dailyMinutes}
          initialFailure={initialFailure}
          note={note}
        />
      )}
    </OnboardingFrame>
  );
}
