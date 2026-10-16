import { NotFoundPage } from "@/components/errors/not-found-page";
import { LearnerWitness } from "@/components/learner/learner-witness";
import { LoginBarLink } from "@/components/login-bar-link";
import { isStartBlocked } from "@/components/public/course-start-remedy";
import { NoAccountNote } from "@/components/public/no-account-note";
import { type CourseStartFailure } from "@/components/public/use-course-start";
import { redirect } from "@/i18n/navigation";
import { CHAPTER_PARAM, MINUTES_PARAM, readDailyMinutes } from "@/lib/public/public-hrefs";
import { getAllowanceCacheTag, getGoalsCacheTag } from "@zoonk/core/cache-tags";
import { type AllowanceLimit } from "@zoonk/core/entitlements/contract";
import { findGoalStartLimit } from "@zoonk/core/entitlements/goal-start-limit";
import { findCourseGoalStart } from "@zoonk/core/goals/start-course";
import { getLibraryCourse } from "@zoonk/core/library/courses/get";
import { getSession } from "@zoonk/core/users/session";
import { type GoalLimitReason } from "@zoonk/learn/onboarding/actions";
import {
  OnboardingColumn,
  OnboardingFrame,
  OnboardingHeading,
  OnboardingPage,
} from "@zoonk/learn/onboarding/frame";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { cacheTag } from "next/cache";
import { connection } from "next/server";
import { Suspense } from "react";
import { OnboardingNotFound } from "../../../_components/onboarding-not-found";
import { getGoalLimitReason } from "../../goal-limit-reason";
import { COURSE_START_ERROR_PARAM } from "../course-start-params";
import { CourseStartScreen } from "./course-start-screen";

type Props = PageProps<"/[lang]/start/course/[courseId]">;

const LIMIT_REASONS = new Set<string>([
  "dailyExplanations",
  "dailyGoals",
  "guest",
  "monthlyExplanations",
  "monthlyGoals",
  "oneActiveGoal",
  "signUpRequired",
  "slowDown",
]);

function isLimitReason(value: string): value is GoalLimitReason {
  return LIMIT_REASONS.has(value);
}

function readParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value ? value : null;
}

/** Why the page's form came back without starting, said again on the page. */
function toFailure(error: string | null): CourseStartFailure | null {
  if (!error) {
    return null;
  }

  return isLimitReason(error) ? { reason: error, status: "limitReached" } : { status: "failed" };
}

/** A course anyone may start: published, or the learner's own private one. */
async function loadStartableCourse(courseId: string) {
  const course = isUuid(courseId) ? await getLibraryCourse({ courseId }) : null;
  return course && (course.isPublished || course.visibility === "private") ? course : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getExtracted();
  const { courseId } = await params;
  const course = await loadStartableCourse(courseId);

  return {
    robots: { follow: false, index: false },
    title: course ? t("Start {course}", { course: course.title }) : t("Start a course"),
  };
}

/** A goal limit the learner already reached, said up front instead of after their answers. */
function toLimitFailure(limit: AllowanceLimit | null): CourseStartFailure | null {
  return limit
    ? { reason: getGoalLimitReason({ limit, status: "limitReached" }), status: "limitReached" }
    : null;
}

/**
 * What the start page shows this browser: the course, the learner's goal already on it and the goal
 * limit they reached. Kept for the browser, so the page opens from its prefetch: both learner facts
 * are only said up front, like a seat map, and starting checks them again (an existing goal is
 * opened, a limit reached meanwhile is said).
 */
async function loadCourseStart(courseId: string) {
  "use cache: private";

  const session = await getSession();

  if (session) {
    cacheTag(getGoalsCacheTag(session.user.id), getAllowanceCacheTag(session.user.id));
  }

  const [course, existing, limit] = await Promise.all([
    loadStartableCourse(courseId),
    findCourseGoalStart(courseId),
    findGoalStartLimit(),
  ]);

  return { course, existing, hasSession: Boolean(session), limit };
}

type CourseStartViewProps = {
  hasSession: boolean;
  screen: React.ComponentProps<typeof CourseStartScreen>;
};

function CourseStartView({ hasSession, screen }: CourseStartViewProps) {
  return (
    <OnboardingPage
      backHref="/courses"
      barEnd={hasSession ? null : <LoginBarLink className="lg:hidden" />}
    >
      <CourseStartScreen {...screen} />
    </OnboardingPage>
  );
}

/** Only a cached wall waits for a live read; an unblocked entry remains fully prefetched. */
async function FreshCourseStart({ locale, ...view }: CourseStartViewProps & { locale: string }) {
  await connection();

  const [existing, limit] = await Promise.all([
    findCourseGoalStart(view.screen.course.id),
    findGoalStartLimit(),
  ]);

  if (existing) {
    redirect({ href: existing.inOnboarding ? `/start/${existing.goalId}` : "/today", locale });
  }

  // Revealed after the page around it, so it says whose page it is too.
  return (
    <>
      <LearnerWitness />
      <CourseStartView
        {...view}
        screen={{ ...view.screen, initialFailure: toLimitFailure(limit) }}
      />
    </>
  );
}

async function CourseStartContent({ params, searchParams }: Props) {
  const t = await getExtracted();
  const [{ courseId, lang }, query] = await Promise.all([params, searchParams]);
  const { course, existing, hasSession, limit } = await loadCourseStart(courseId);

  if (!course) {
    return (
      <NotFoundPage>
        <LearnerWitness />
        <OnboardingNotFound />
      </NotFoundPage>
    );
  }

  // Their goal on this course already: back to it, without asking their level again.
  if (existing) {
    redirect({
      href: existing.inOnboarding ? `/start/${existing.goalId}` : "/today",
      locale: lang,
    });
  }

  const chapterId = readParam(query[CHAPTER_PARAM]);
  const chapters = course.levels.flatMap((band) => band.chapters);
  const chapter = chapters.find((item) => item.id === chapterId && item.lessons.length > 0);
  const planned = chapter ? chapters.slice(chapters.indexOf(chapter)) : chapters;

  const screen: CourseStartViewProps["screen"] = {
    chapter: chapter ? { id: chapter.id, title: chapter.title } : null,
    chapters: planned.map((item) => ({
      id: item.id,
      lessons: item.lessons.length,
      title: item.title,
    })),
    course: { id: course.id, title: course.title },
    dailyMinutes: readDailyMinutes(query[MINUTES_PARAM]),
    initialFailure: toFailure(readParam(query[COURSE_START_ERROR_PARAM])) ?? toLimitFailure(limit),
    note: (
      <NoAccountNote>
        <p className="text-muted-foreground text-center text-sm" data-slot="start-note">
          {t("Start free, no account needed.")}
        </p>
      </NoAccountNote>
    ),
  };

  const cached = <CourseStartView hasSession={hasSession} screen={screen} />;

  return (
    <>
      <LearnerWitness />
      {isStartBlocked(screen.initialFailure) ? (
        <Suspense fallback={cached}>
          <FreshCourseStart hasSession={hasSession} locale={lang} screen={screen} />
        </Suspense>
      ) : (
        cached
      )}
    </>
  );
}

/** The start's shape while it loads: the course over the question, the levels, and Start. */
function CourseStartSkeleton() {
  return (
    <OnboardingPage backHref="/courses">
      <OnboardingFrame>
        <OnboardingColumn aria-busy="true">
          <OnboardingHeading>
            <Skeleton className="h-4 w-32" data-slot="page-eyebrow" />
            <Skeleton className="h-16.5 w-4/5 sm:h-8.25" />
            <Skeleton className="mt-1 h-5 w-3/5" />
          </OnboardingHeading>

          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>

          <Skeleton className="mt-auto h-11 w-full sm:mt-0" />
        </OnboardingColumn>
      </OnboardingFrame>
    </OnboardingPage>
  );
}

/**
 * Where every start of a whole course leads (asking the learner's level first), a visitor without
 * JavaScript lands, and a shareable way to start a course or one of its chapters (`?chapter=`), as
 * a page of the app's frame: the page only asks and shows its start button, since links are
 * followed by crawlers too. The button starts the goal.
 */
export default function CourseStartPage(props: Props) {
  return (
    <Suspense fallback={<CourseStartSkeleton />}>
      <CourseStartContent {...props} />
    </Suspense>
  );
}
