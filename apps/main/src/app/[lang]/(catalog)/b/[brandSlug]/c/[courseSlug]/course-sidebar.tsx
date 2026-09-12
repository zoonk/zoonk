import { CatalogActions } from "@/components/catalog/catalog-actions";
import { getCoursePath } from "@/data/courses/get-course-path";
import { getContinueLessonTarget } from "@/data/progress/get-catalog-target";
import { getPendingGenerationHref } from "@/data/progress/get-pending-generation-href";
import { Link } from "@/i18n/navigation";
import { getCourse } from "@zoonk/core/courses/get-by-slug";
import { CURRENT_CURRICULUM_VERSION } from "@zoonk/core/courses/learning-plan-contract";
import { getSession } from "@zoonk/core/users/session";
import { GridToolbar } from "@zoonk/ui/components/grid";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { CourseHeader } from "./course-header";
import { CourseStartAction } from "./course-start-action";

async function getNextTarget({
  brandSlug,
  isLegacy,
  path,
  previous,
}: {
  brandSlug: string;
  isLegacy: boolean;
  path: Awaited<ReturnType<typeof getCoursePath>>;
  previous: Awaited<ReturnType<typeof getContinueLessonTarget>>;
}) {
  if (isLegacy) {
    if (!previous || previous.completed) {
      return null;
    }

    const pendingHref = await getPendingGenerationHref(previous);

    return {
      ...previous,
      brandSlug,
      generationStatus: pendingHref ? ("pending" as const) : ("completed" as const),
    };
  }

  return path.status === "ready" ? path.nextTarget : null;
}

export async function CourseSidebar({
  params,
}: Pick<PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]">, "params">) {
  const { brandSlug, courseSlug } = await params;

  const [course, session, t] = await Promise.all([
    getCourse({ brandSlug, courseSlug }),
    getSession(),
    getExtracted(),
  ]);

  if (!course) {
    notFound();
  }

  const [path, previous] = await Promise.all([
    getCoursePath(course.id),
    getContinueLessonTarget({ scope: { courseId: course.id } }),
  ]);

  const savedPlan = path.status === "ready" ? path.plan : null;
  const hasStarted = savedPlan !== null || previous?.hasStarted === true;

  const hasOwnScope =
    course.format === "question" ||
    course.format === "personalized" ||
    (path.status === "ready" && !path.supportsLearningPlan);

  const isLegacy = course.curriculumVersion < CURRENT_CURRICULUM_VERSION && !savedPlan;

  const nextTarget = await getNextTarget({ brandSlug, isLegacy, path, previous });

  const startHref = `/b/${brandSlug}/c/${courseSlug}/start` as const;

  return (
    <>
      <CourseHeader brandSlug={brandSlug} course={course} variant="sidebar" />
      <GridToolbar>
        <CourseStartAction
          brandSlug={brandSlug}
          courseId={course.id}
          courseSlug={courseSlug}
          hasOwnScope={hasOwnScope}
          hasStarted={hasStarted}
          nextTarget={nextTarget}
          path={path}
        />
        {!course.userId && (
          <CatalogActions
            defaultEmail={session?.user.email}
            feedbackTarget={{ courseSlug, kind: "course" }}
          />
        )}
      </GridToolbar>
      {hasStarted && !hasOwnScope && (
        <Link
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          href={startHref}
        >
          {t("Change learning path")}
        </Link>
      )}
      {savedPlan && (
        <Link
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          href={`/b/${brandSlug}/c/${courseSlug}/preferences`}
        >
          {t("Learning preferences")}
        </Link>
      )}
      {path.status === "ready" && path.progress.completedLessons > 0 && (
        <p className="text-muted-foreground text-sm">
          {t("{count, plural, one {# lesson completed} other {# lessons completed}}", {
            count: path.progress.completedLessons,
          })}
        </p>
      )}
    </>
  );
}
