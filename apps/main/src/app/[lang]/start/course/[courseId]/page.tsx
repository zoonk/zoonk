import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { NoAccountNote } from "@/components/public/no-account-note";
import { type CourseStartFailure } from "@/components/public/use-course-start";
import { redirect } from "@/i18n/navigation";
import { CHAPTER_PARAM } from "@/lib/public/public-hrefs";
import { type AllowanceLimit } from "@zoonk/core/entitlements/contract";
import { findGoalStartLimit } from "@zoonk/core/entitlements/goal-start-limit";
import { findCourseGoalStart } from "@zoonk/core/goals/start-course";
import { getLibraryCourse } from "@zoonk/core/library/courses/get";
import { type GoalLimitReason } from "@zoonk/learn/onboarding/actions";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
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
  const [{ courseId }, t] = await Promise.all([params, getExtracted()]);
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

async function CourseStartContent({ params, searchParams }: Props) {
  // Their goal on the course and whether they can start another are read fresh for each visit.
  await connection();
  const [{ courseId, lang }, query, t] = await Promise.all([params, searchParams, getExtracted()]);

  const [course, existing, limit] = await Promise.all([
    loadStartableCourse(courseId),
    findCourseGoalStart(courseId),
    findGoalStartLimit(),
  ]);

  if (!course) {
    notFound();
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

  return (
    <MainLearnProvider>
      <CourseStartScreen
        chapter={chapter ? { id: chapter.id, title: chapter.title } : null}
        chapters={planned.map((item) => ({
          id: item.id,
          lessons: item.lessons.length,
          title: item.title,
        }))}
        course={{ id: course.id, title: course.title }}
        initialFailure={
          toFailure(readParam(query[COURSE_START_ERROR_PARAM])) ?? toLimitFailure(limit)
        }
        note={
          <NoAccountNote>
            <p className="text-muted-foreground text-center text-sm" data-slot="start-note">
              {t("Free to start. No account needed for your first lesson.")}
            </p>
          </NoAccountNote>
        }
      />
    </MainLearnProvider>
  );
}

function CourseStartSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 pt-24 sm:pt-32">
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="mt-auto mb-8 h-12 w-full rounded-full" />
    </main>
  );
}

/**
 * Where every start of a whole course leads (asking the learner's level first), a visitor without
 * JavaScript lands, and a shareable way to start a course or one of its chapters (`?chapter=`):
 * the page only asks and shows its start button, since links are followed by crawlers too. The
 * button starts the goal.
 */
export default function CourseStartPage(props: Props) {
  return (
    <Suspense fallback={<CourseStartSkeleton />}>
      <CourseStartContent {...props} />
    </Suspense>
  );
}
