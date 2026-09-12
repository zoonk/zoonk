import { CourseSetupForm } from "@/components/courses/course-setup-form";
import { getCoursePath } from "@/data/courses/get-course-path";
import { Link, redirect } from "@/i18n/navigation";
import { getCourse } from "@zoonk/core/courses/get-by-slug";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ArrowLeftIcon } from "lucide-react";
import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { startCourseAction } from "./start-course-action";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Start learning") };
}

async function CourseStartContent({
  params,
}: Pick<PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/start">, "params">) {
  const { brandSlug, courseSlug, lang: locale } = await params;
  const [course, t] = await Promise.all([getCourse({ brandSlug, courseSlug }), getExtracted()]);

  if (!course) {
    notFound();
  }

  if (course.format === "question" || course.format === "personalized") {
    return redirect({
      href: `/b/${brandSlug}/c/${courseSlug}?edition=original`,
      locale: await getLocale(),
    });
  }

  const result = await getCoursePath(course.id);

  if (result.status === "ready" && !result.supportsLearningPlan) {
    const target = result.nextTarget;
    const courseHref = `/b/${brandSlug}/c/${courseSlug}` as const;
    const chapterHref = target ? (`${courseHref}/ch/${target.chapterSlug}` as const) : courseHref;

    return redirect({
      href: target?.lessonSlug ? `${chapterHref}/l/${target.lessonSlug}` : chapterHref,
      locale,
    });
  }

  const plan = result.status === "ready" ? result.plan : null;

  const defaultInput = plan
    ? {
        dailyMinutes: plan.dailyMinutes,
        depth: plan.depth,
        goal: plan.goal,
        hiddenLessonKinds: plan.hiddenLessonKinds,
        startingKnowledge: plan.startingKnowledge,
        startingLevel: plan.startingLevel,
      }
    : undefined;

  const startAction = startCourseAction.bind(null, {
    brandSlug,
    courseId: course.id,
    courseSlug,
    expectedRevision: plan?.revision ?? 0,
    locale,
  });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-6 sm:py-12">
      <header className="flex flex-col items-start gap-4">
        <Link
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm"
          href={`/b/${brandSlug}/c/${courseSlug}?edition=original`}
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          {t("Back to course")}
        </Link>
        <h1 className="text-muted-foreground text-base font-medium" lang={course.language}>
          {course.title}
        </h1>
      </header>
      <CourseSetupForm
        courseId={course.id}
        defaultInput={defaultInput}
        format={course.format === "language" ? "language" : "core"}
        onStart={startAction}
      />
    </main>
  );
}

function CourseStartSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-16">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

export default function CourseStartPage(
  props: PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/start">,
) {
  return (
    <Suspense fallback={<CourseStartSkeleton />}>
      <CourseStartContent params={props.params} />
    </Suspense>
  );
}
