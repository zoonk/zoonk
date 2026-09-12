import { CoursePreferencesForm } from "@/components/courses/course-preferences-form";
import { Link, getPathname, redirect } from "@/i18n/navigation";
import { getCourse } from "@zoonk/core/courses/get-by-slug";
import { getCurrentUserCoursePlan } from "@zoonk/core/courses/learning-plan";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ArrowLeftIcon } from "lucide-react";
import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { saveCoursePreferences } from "./preference-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Learning preferences") };
}

async function CoursePreferencesContent({
  params,
}: Pick<PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/preferences">, "params">) {
  const { brandSlug, courseSlug } = await params;

  const [course, t, locale] = await Promise.all([
    getCourse({ brandSlug, courseSlug }),
    getExtracted(),
    getLocale(),
  ]);

  if (!course) {
    notFound();
  }

  const current = await getCurrentUserCoursePlan({ courseId: course.id });

  if (current.status === "unauthorized") {
    const next = getPathname({ href: `/b/${brandSlug}/c/${courseSlug}/preferences`, locale });
    return redirect({ href: `/login?next=${encodeURIComponent(next)}`, locale });
  }

  if (current.status !== "ready") {
    notFound();
  }

  if (!current.plan) {
    return redirect({ href: `/b/${brandSlug}/c/${courseSlug}/start`, locale });
  }

  const { plan } = current;

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
        <div className="flex flex-col gap-1">
          <h1 className="font-medium">{t("Learning preferences")}</h1>
          <p className="text-muted-foreground text-sm" lang={course.language}>
            {course.title}
          </p>
        </div>
      </header>
      <CoursePreferencesForm
        defaultInput={{
          dailyMinutes: plan.dailyMinutes,
          depth: plan.depth,
          hiddenLessonKinds: plan.hiddenLessonKinds,
        }}
        isLanguage={course.format === "language"}
        onSave={saveCoursePreferences.bind(null, {
          brandSlug,
          courseId: course.id,
          courseSlug,
          expectedRevision: plan.revision,
          locale,
        })}
      />
    </main>
  );
}

function PreferencesSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-12">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export default function CoursePreferencesPage(
  props: PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/preferences">,
) {
  return (
    <Suspense fallback={<PreferencesSkeleton />}>
      <CoursePreferencesContent params={props.params} />
    </Suspense>
  );
}
