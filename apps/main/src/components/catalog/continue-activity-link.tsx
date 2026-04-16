import { type ActivityScope } from "@zoonk/core/activities/last-completed";
import { getNextActivity } from "@zoonk/core/progress/next-activity";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { type Route } from "next";
import { getExtracted } from "next-intl/server";
import Link from "next/link";

function getScope(props: {
  chapterId?: string;
  courseId?: string;
  lessonId?: string;
}): ActivityScope {
  if (props.courseId) {
    return { courseId: props.courseId };
  }

  if (props.chapterId) {
    return { chapterId: props.chapterId };
  }

  if (props.lessonId) {
    return { lessonId: props.lessonId };
  }

  throw new Error("ContinueActivityLink requires a course, chapter, or lesson id.");
}

export async function ContinueActivityLink<Href extends string, CompletedHref extends string>({
  chapterId,
  completedHref,
  courseId,
  fallbackHref,
  lessonId,
}: {
  chapterId?: string;
  completedHref?: Route<CompletedHref>;
  courseId?: string;
  fallbackHref?: Route<Href>;
  lessonId?: string;
}) {
  const t = await getExtracted();
  const scope = getScope({ chapterId, courseId, lessonId });
  const data = await getNextActivity({ scope });
  const className = cn(buttonVariants(), "min-w-0 flex-1 gap-2");

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
        {label}
        <ChevronRightIcon aria-hidden="true" />
      </Link>
    );
  }

  /**
   * When we cannot compute a next activity at all, the parent page already has
   * the safest fallback for its own level: first chapter, first lesson, or
   * first activity. Reusing that fallback avoids duplicating page-specific
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
   * sending users back into a finished activity.
   */
  if (data.completed && completedHref) {
    return (
      <Link className={className} href={completedHref}>
        {label}
        <ChevronRightIcon aria-hidden="true" />
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
   * Generated activities are safe to deep-link to directly, so we send users
   * straight into the activity route and allow prefetching.
   */
  if (data.canPrefetch) {
    return (
      <Link
        className={className}
        href={`/b/${data.brandSlug}/c/${data.courseSlug}/ch/${data.chapterSlug}/l/${data.lessonSlug}/a/${data.activityPosition}`}
        prefetch
      >
        {label}
        <ChevronRightIcon aria-hidden="true" />
      </Link>
    );
  }

  /**
   * Lesson pages already loaded the activity list and passed a concrete first
   * activity href as the fallback. Reusing that href avoids the no-op
   * self-link that happens when the first activity exists but is still pending.
   */
  if (lessonId) {
    return renderFallback({ label });
  }

  /**
   * Course and chapter pages may only know the lesson-level destination when
   * the activity is still pending, so we fall back to the lesson shell there.
   */
  return (
    <Link
      className={className}
      href={`/b/${data.brandSlug}/c/${data.courseSlug}/ch/${data.chapterSlug}/l/${data.lessonSlug}`}
      prefetch={false}
    >
      {label}
      <ChevronRightIcon aria-hidden="true" />
    </Link>
  );
}

export async function ContinueActivityLinkSkeleton() {
  const t = await getExtracted();

  return (
    <Button className="min-w-0 flex-1 gap-2" disabled>
      {t("Start")}
      <ChevronRightIcon aria-hidden="true" />
    </Button>
  );
}
