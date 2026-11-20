import { NotFoundPage } from "@/components/errors/not-found-page";
import { LoginBarLink } from "@/components/login-bar-link";
import { isStartBlocked } from "@/components/public/course-start-remedy";
import { type CourseStartFailure } from "@/components/public/use-course-start";
import { redirect } from "@/i18n/navigation";
import { getGoalLimit } from "@/lib/goals/goal-limit-reason";
import {
  CHAPTER_PARAM,
  MINUTES_PARAM,
  getCourseStartHref,
  readDailyMinutes,
} from "@/lib/public/public-hrefs";
import { getAllowanceCacheTag, getGoalsCacheTag } from "@zoonk/core/cache-tags";
import { listPublishedCourseEditions } from "@zoonk/core/courses/published-editions";
import { type AllowanceLimit } from "@zoonk/core/entitlements/contract";
import { findGoalStartLimit } from "@zoonk/core/entitlements/goal-start-limit";
import { getCourseQuickTestMinutes } from "@zoonk/core/goals/course-quick-test";
import { resolveCourseStartLanguage } from "@zoonk/core/goals/course-start-language";
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
import { getLanguageNameInSentence } from "@zoonk/utils/languages";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { cacheTag } from "next/cache";
import { connection } from "next/server";
import { Suspense } from "react";
import { OnboardingNotFound } from "../../../_components/onboarding-not-found";
import { COURSE_START_ERROR_PARAM } from "../course-start-params";
import { CourseStartScreen } from "./course-start-screen";

type Props = PageProps<"/[lang]/start/course/[courseId]">;

const LIMIT_REASONS = new Set<string>([
  "activeGoals",
  "dailyExplanations",
  "dailyGoals",
  "guest",
  "monthlyExplanations",
  "monthlyGoals",
  "signUpRequired",
  "slowDown",
]);

function isLimitReason(value: string): value is GoalLimitReason {
  return LIMIT_REASONS.has(value);
}

function readParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value ? value : null;
}

function toFailure(error: string | null): CourseStartFailure | null {
  if (!error) {
    return null;
  }

  return isLimitReason(error) ? { reason: error, status: "limitReached" } : { status: "failed" };
}

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

function toLimitFailure(limit: AllowanceLimit | null): CourseStartFailure | null {
  return limit ? { ...getGoalLimit(limit), status: "limitReached" } : null;
}

/** Kept for the browser so the page opens from its prefetch; starting checks both learner facts again. */
async function loadCourseStart(courseId: string, language: string) {
  "use cache: private";

  const session = await getSession();

  if (session) {
    cacheTag(getGoalsCacheTag(session.user.id), getAllowanceCacheTag(session.user.id));
  }

  const [course, editions, existing, limit] = await Promise.all([
    loadStartableCourse(courseId).then(
      async (found) =>
        found && { ...found, quickTestMinutes: await getCourseQuickTestMinutes(found) },
    ),
    listPublishedCourseEditions({ courseId }),
    findCourseGoalStart(courseId, language),
    findGoalStartLimit(),
  ]);

  const start = course
    ? resolveCourseStartLanguage({ course: { editions, language: course.language }, language })
    : null;

  return { course, existing, hasSession: Boolean(session), limit, start };
}

type CourseStartViewProps = {
  hasSession: boolean;
  screen: React.ComponentProps<typeof CourseStartScreen>;
};

function CourseStartView({ hasSession, screen }: CourseStartViewProps) {
  return (
    <OnboardingPage
      backHref="/courses"
      barEnd={hasSession ? null : <LoginBarLink className="lg:hidden" edge="end" />}
    >
      <CourseStartScreen {...screen} />
    </OnboardingPage>
  );
}

/** Only a cached wall waits for a live read; an unblocked entry remains fully prefetched. */
async function FreshCourseStart({ locale, ...view }: CourseStartViewProps & { locale: string }) {
  await connection();

  const [existing, limit] = await Promise.all([
    findCourseGoalStart(view.screen.course.id, locale),
    findGoalStartLimit(),
  ]);

  if (existing) {
    redirect({ href: existing.inOnboarding ? `/start/${existing.goalId}` : "/today", locale });
  }

  return (
    <CourseStartView {...view} screen={{ ...view.screen, initialFailure: toLimitFailure(limit) }} />
  );
}

async function CourseStartContent({ params, searchParams }: Props) {
  const t = await getExtracted();
  const [{ courseId, lang }, query] = await Promise.all([params, searchParams]);
  const { course, existing, hasSession, limit, start } = await loadCourseStart(courseId, lang);

  if (!course || !start) {
    return (
      <NotFoundPage>
        <OnboardingNotFound />
      </NotFoundPage>
    );
  }

  if (existing) {
    redirect({
      href: existing.inOnboarding ? `/start/${existing.goalId}` : "/today",
      locale: lang,
    });
  }

  const dailyMinutes = readDailyMinutes(query[MINUTES_PARAM]);

  if (start.kind === "edition") {
    redirect({
      href: getCourseStartHref({ courseId: start.edition.id, minutes: dailyMinutes }),
      locale: lang,
    });
  }

  const chapterId = start.kind === "same" ? readParam(query[CHAPTER_PARAM]) : null;
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
    course: { id: course.id, quickTestMinutes: course.quickTestMinutes, title: course.title },
    dailyMinutes,
    initialFailure: toLimitFailure(limit) ?? toFailure(readParam(query[COURSE_START_ERROR_PARAM])),
    languageNote:
      start.kind === "learnerLanguage"
        ? t({
            description:
              "Under the level question when a course's language isn't the app's. Both placeholders are language names, as they're written mid-sentence",
            message: "This course is in {courseLanguage}. Your lessons will be in {language}.",
            values: {
              courseLanguage: getLanguageNameInSentence({
                targetLanguage: course.language,
                userLanguage: lang,
              }),
              language: getLanguageNameInSentence({
                targetLanguage: start.language,
                userLanguage: lang,
              }),
            },
          })
        : null,
    note: (
      <p className="text-muted-foreground text-sm lg:text-right">
        {t("Start free, no account needed.")}
      </p>
    ),
  };

  const cached = <CourseStartView hasSession={hasSession} screen={screen} />;

  return isStartBlocked(screen.initialFailure) ? (
    <Suspense fallback={cached}>
      <FreshCourseStart hasSession={hasSession} locale={lang} screen={screen} />
    </Suspense>
  ) : (
    cached
  );
}

function CourseStartSkeleton() {
  return (
    <OnboardingPage backHref="/courses">
      <OnboardingFrame>
        <OnboardingColumn aria-busy="true">
          <OnboardingHeading>
            <Skeleton className="h-5.5 w-32" data-slot="onboarding-subject" />
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

/** The page only asks and shows its start button: crawlers follow links too. */
export default function CourseStartPage(props: Props) {
  return (
    <Suspense fallback={<CourseStartSkeleton />}>
      <CourseStartContent {...props} />
    </Suspense>
  );
}
