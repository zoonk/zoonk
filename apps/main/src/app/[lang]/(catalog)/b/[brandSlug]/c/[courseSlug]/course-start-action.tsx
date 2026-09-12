import { ResumeCourseButton } from "@/components/courses/resume-course-button";
import { type getCoursePath } from "@/data/courses/get-course-path";
import { getCurriculumGenerationView } from "@/data/courses/get-curriculum-generation-view";
import { getLearningTargetHref } from "@/data/courses/learning-target-href";
import { Link } from "@/i18n/navigation";
import { type CourseLearningTarget } from "@zoonk/core/courses/learning-plan";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRightIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

type CourseStartProps = {
  brandSlug: string;
  courseId: string;
  courseSlug: string;
  hasOwnScope: boolean;
  hasStarted: boolean;
  nextTarget: CourseLearningTarget | null;
  path: Awaited<ReturnType<typeof getCoursePath>>;
};

function getReviewHref({ brandSlug, courseId, courseSlug, path }: CourseStartProps) {
  const chapter = path.status === "ready" ? path.chapters[0] : null;

  if (!chapter) {
    return `/generate/curriculum/${courseId}` as const;
  }

  const lesson = chapter.lessons[0];

  return lesson
    ? (`/b/${brandSlug}/c/${courseSlug}/ch/${chapter.slug}/l/${lesson.slug}` as const)
    : (`/b/${brandSlug}/c/${courseSlug}/ch/${chapter.slug}` as const);
}

function getStartHref(props: CourseStartProps) {
  if ((props.hasStarted || props.hasOwnScope) && props.nextTarget) {
    return getLearningTargetHref(props.nextTarget);
  }

  return props.hasOwnScope
    ? getReviewHref(props)
    : (`/b/${props.brandSlug}/c/${props.courseSlug}/start` as const);
}

async function CourseStartLabel({
  hasOwnScope,
  hasStarted,
  nextTarget,
}: Pick<CourseStartProps, "hasOwnScope" | "hasStarted" | "nextTarget">) {
  const t = await getExtracted();

  if (!hasStarted) {
    return t("Start");
  }

  if (nextTarget) {
    return t("Continue");
  }

  if (hasOwnScope) {
    return t("Revisit lessons");
  }

  return t("Choose your next steps");
}

export async function CourseStartAction(props: CourseStartProps) {
  const { courseId, path } = props;
  const firstChapter = path.status === "ready" ? path.chapters[0] : null;
  const generation = firstChapter ? null : await getCurriculumGenerationView(courseId);

  const canStart =
    firstChapter ||
    generation?.status === "unauthorized" ||
    (generation?.status === "ready" && generation.needsGeneration);

  if (!canStart) {
    return null;
  }

  if (path.status === "ready" && path.plan && path.needsPlan) {
    return <ResumeCourseButton courseId={courseId} />;
  }

  return (
    <Link
      className={cn(buttonVariants(), "min-h-11 min-w-0 flex-1 gap-2")}
      href={getStartHref(props)}
      prefetch={false}
    >
      <CourseStartLabel
        hasOwnScope={props.hasOwnScope}
        hasStarted={props.hasStarted}
        nextTarget={props.nextTarget}
      />
      <ArrowRightIcon aria-hidden="true" />
    </Link>
  );
}
