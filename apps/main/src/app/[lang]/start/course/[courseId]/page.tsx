import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { type CourseStartFailure } from "@/components/public/use-course-start";
import { getExperienceMode } from "@/lib/learn/experience-mode";
import { CHAPTER_PARAM } from "@/lib/public/public-hrefs";
import { getLibraryCourse } from "@zoonk/core/library/courses/get";
import { DeviceModeRoot } from "@zoonk/learn/mode";
import { type GoalLimitReason } from "@zoonk/learn/onboarding/actions";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { COURSE_START_ERROR_PARAM } from "../course-start-params";
import { CourseStartScreen } from "./course-start-screen";

type Props = PageProps<"/[lang]/start/course/[courseId]">;

const LIMIT_REASONS = new Set<string>(["dailyGoals", "guest", "oneActiveGoal", "slowDown"]);

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

async function CourseStartContent({ params, searchParams }: Props) {
  const [{ courseId }, query, mode] = await Promise.all([
    params,
    searchParams,
    getExperienceMode(),
  ]);

  const course = await loadStartableCourse(courseId);

  if (!course) {
    notFound();
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
        initialFailure={toFailure(readParam(query[COURSE_START_ERROR_PARAM]))}
        initialMode={mode}
      />
    </MainLearnProvider>
  );
}

function CourseStartSkeleton() {
  return (
    <DeviceModeRoot>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 pt-24 sm:pt-32">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="mt-auto mb-8 h-12 w-full rounded-full" />
      </main>
    </DeviceModeRoot>
  );
}

/**
 * Where "Start this course" leads without JavaScript, and a shareable way to start a course or
 * one of its chapters (`?chapter=`): the page only shows the course and its start button, since
 * links are followed by crawlers too. The button starts the goal.
 */
export default function CourseStartPage(props: Props) {
  return (
    <Suspense fallback={<CourseStartSkeleton />}>
      <CourseStartContent {...props} />
    </Suspense>
  );
}
