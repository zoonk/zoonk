import {
  type ContinueLessonProgress,
  getChapterContinueProgress,
  getCourseContinueProgress,
} from "@/data/progress/catalog-progress";
import { type AppRoute, Link } from "@/i18n/navigation";
import { type LessonScope } from "@zoonk/core/lessons/last-completed";
import { getContinueLessonTarget } from "@zoonk/core/progress/continue-lesson-target";
import { type LessonKind } from "@zoonk/db";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

type ContinueLessonProgressContent = { ariaLabel: string; text: string };

const EMPTY_EXCLUDED_LESSON_KINDS: LessonKind[] = [];

function getScope(props: {
  chapterId?: string;
  courseId?: string;
  lessonId?: string;
}): LessonScope {
  if (props.courseId) {
    return { courseId: props.courseId };
  }

  if (props.chapterId) {
    return { chapterId: props.chapterId };
  }

  if (props.lessonId) {
    return { lessonId: props.lessonId };
  }

  throw new Error("ContinueLessonLink requires a course, chapter, or lesson id.");
}

/**
 * Progress can start at zero, but it still needs a valid percentage before it
 * is worth replacing the arrow. Clamping keeps stale data from leaking an
 * impossible value into the compact suffix.
 */
function getVisibleProgress({ progress }: { progress?: ContinueLessonProgress | null }) {
  if (!progress) {
    return null;
  }

  return { percentComplete: Math.min(Math.max(progress.percentComplete, 0), 100) };
}

/**
 * The Continue button owns its compact progress suffix. Looking up progress
 * from the scope keeps pages from threading promises through sibling
 * components just to feed this small visual hint.
 */
function getContinueLessonProgress({
  excludedLessonKinds,
  scope,
}: {
  excludedLessonKinds: LessonKind[];
  scope: LessonScope;
}) {
  if ("courseId" in scope) {
    return getCourseContinueProgress({ courseId: scope.courseId, excludedLessonKinds });
  }

  if ("chapterId" in scope) {
    return getChapterContinueProgress({ chapterId: scope.chapterId, excludedLessonKinds });
  }

  return Promise.resolve(null);
}

/**
 * The visible suffix is intentionally just a percent so the mobile CTA stays
 * compact, while the hidden text gives screen readers the full meaning.
 */
function ContinueLessonLinkContent({
  label,
  progress,
}: {
  label: string;
  progress: ContinueLessonProgressContent | null;
}) {
  if (!progress) {
    return (
      <span className="inline-flex min-w-0 items-center justify-center gap-1.5">
        {label}
        <ChevronRightIcon aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-0 items-baseline justify-center gap-1.5 leading-none">
      <span className="min-w-0 truncate leading-none">{label}</span>
      <span
        aria-hidden="true"
        className="text-primary-foreground/65 text-[0.7rem] leading-none font-medium tabular-nums"
      >
        {progress.text}
      </span>
      <span className="sr-only">{progress.ariaLabel}</span>
    </span>
  );
}

export async function ContinueLessonLink<Href extends string, CompletedHref extends string>({
  chapterId,
  completedHref,
  courseId,
  excludedLessonKinds = EMPTY_EXCLUDED_LESSON_KINDS,
  fallbackHref,
  lessonId,
}: {
  chapterId?: string;
  completedHref?: AppRoute<CompletedHref>;
  courseId?: string;
  excludedLessonKinds?: LessonKind[];
  fallbackHref?: AppRoute<Href>;
  lessonId?: string;
}) {
  const t = await getExtracted();
  const scope = getScope({ chapterId, courseId, lessonId });

  const [data, resolvedProgress] = await Promise.all([
    getContinueLessonTarget({ excludedLessonKinds, scope }),
    getContinueLessonProgress({ excludedLessonKinds, scope }),
  ]);

  const className = cn(buttonVariants(), "min-w-0 flex-1 gap-2");
  const visibleProgress = getVisibleProgress({ progress: resolvedProgress });

  const progressContent = visibleProgress
    ? {
        ariaLabel: t("{percent}% complete", { percent: String(visibleProgress.percentComplete) }),
        text: `${visibleProgress.percentComplete}%`,
      }
    : null;

  /**
   * Some catalog pages can compute a safe first-child route, while others may
   * legitimately have no child route at all. Centralizing the fallback render
   * keeps that "render nothing when no safe fallback exists" rule in one place.
   */
  function renderFallback({ label }: { label: string }) {
    if (!fallbackHref) {
      return null;
    }

    return (
      <Link className={className} href={fallbackHref} prefetch={false}>
        <ContinueLessonLinkContent label={label} progress={progressContent} />
      </Link>
    );
  }

  /**
   * When we cannot compute a next lesson at all, the parent page already has
   * the safest fallback for its own level: first chapter, first lesson, or
   * first lesson. Reusing that fallback avoids duplicating page-specific
   * routing rules here.
   */
  if (!data) {
    return renderFallback({ label: t("Start") });
  }

  const getLabel = () => {
    if (data.completed) {
      return completedHref ? t("Continue") : t("Review");
    }

    if (data.hasStarted) {
      return t("Continue");
    }

    return t("Start");
  };

  const label = getLabel();

  /**
   * Once the current scope is fully completed, the parent can provide the next
   * lesson/chapter route. We prefer that explicit sibling destination over
   * sending users back into a finished lesson.
   */
  if (data.completed && completedHref) {
    return (
      <Link className={className} href={completedHref}>
        <ContinueLessonLinkContent label={label} progress={progressContent} />
      </Link>
    );
  }

  /**
   * Catalog pages always live under a brand URL. If progress data cannot give
   * us that slug, the safest option is to stay with the route the parent page
   * already knows is valid.
   */
  if (!data.brandSlug) {
    return renderFallback({ label });
  }

  /**
   * Completed generated lessons can still lead to an ungenerated next chapter.
   * Those targets intentionally have no lesson slug, so route them to the
   * chapter page where the normal generation redirect can take over.
   */
  if (!("lessonSlug" in data)) {
    return (
      <Link
        className={className}
        href={`/b/${data.brandSlug}/c/${data.courseSlug}/ch/${data.chapterSlug}`}
        prefetch={false}
      >
        <ContinueLessonLinkContent label={label} progress={progressContent} />
      </Link>
    );
  }

  if (data.canPrefetch) {
    return (
      <Link
        className={className}
        href={`/b/${data.brandSlug}/c/${data.courseSlug}/ch/${data.chapterSlug}/l/${data.lessonSlug}`}
        prefetch
      >
        <ContinueLessonLinkContent label={label} progress={progressContent} />
      </Link>
    );
  }

  if (lessonId) {
    return renderFallback({ label });
  }

  return (
    <Link
      className={className}
      href={`/b/${data.brandSlug}/c/${data.courseSlug}/ch/${data.chapterSlug}/l/${data.lessonSlug}`}
      prefetch={false}
    >
      <ContinueLessonLinkContent label={label} progress={progressContent} />
    </Link>
  );
}

export async function ContinueLessonLinkSkeleton() {
  const t = await getExtracted();

  return (
    <Button className="min-w-0 flex-1 gap-2" disabled>
      {t("Start")}
      <ChevronRightIcon aria-hidden="true" />
    </Button>
  );
}
