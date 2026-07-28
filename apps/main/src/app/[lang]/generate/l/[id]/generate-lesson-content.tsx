import { GenerationExitLink } from "@/components/generation/generation-exit-link";
import { SubscriptionGate } from "@/components/subscription/subscription-gate";
import { redirect } from "@/i18n/navigation";
import { getLessonDisplayMeta } from "@/lib/lessons";
import { getInitialGenerationPageStatus } from "@/lib/workflow/get-initial-generation-page-status";
import {
  getChapterLessonsCacheTag,
  getCourseCurriculumCacheTag,
  getLessonCacheTag,
  getLessonRouteCacheTag,
} from "@zoonk/core/cache-tags";
import { getLessonGenerationView } from "@zoonk/core/workflows/lesson-generation-view";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { invalidateGeneratedContent } from "../../invalidate-generated-content";
import { GenerationClient } from "./generation-client";

export async function GenerateLessonContent({
  params,
}: {
  params: Promise<{ id: string; lang: string }>;
}) {
  const { id, lang: locale } = await params;
  const view = await getLessonGenerationView(id);

  if (view.status === "notFound") {
    notFound();
  }

  if (view.status === "redirectToSource") {
    return redirect({ href: `/generate/l/${view.sourceLessonId}`, locale });
  }

  const { lesson } = view;
  const t = await getExtracted();

  const backHref =
    `/b/${AI_ORG_SLUG}/c/${lesson.chapter.course.slug}/ch/${lesson.chapter.slug}` as const;

  const backLabel = t("Back to chapter");

  const lessonMeta = view.status === "ready" ? await getLessonDisplayMeta(lesson) : null;

  const generatedLessonCacheTags = [
    getCourseCurriculumCacheTag(lesson.chapter.course.id),
    getChapterLessonsCacheTag(lesson.chapter.id),
    getLessonCacheTag(lesson.id),
    getLessonRouteCacheTag({
      brandSlug: AI_ORG_SLUG,
      chapterSlug: lesson.chapter.slug,
      courseSlug: lesson.chapter.course.slug,
      lessonSlug: lesson.slug,
    }),
  ];

  /** Invalidates only the lesson resolved by this server-rendered generation page. */
  async function invalidateGeneratedLesson() {
    "use server";

    invalidateGeneratedContent(generatedLessonCacheTags);
  }

  const content =
    view.status === "ready" && lessonMeta ? (
      <GenerationClient
        chapterSlug={lesson.chapter.slug}
        courseSlug={lesson.chapter.course.slug}
        generationRunId={lesson.generationRunId}
        initialStatus={getInitialGenerationPageStatus({
          generationStatus: lesson.generationStatus,
          isReadyForRedirect: view.isReadyForRedirect,
        })}
        invalidateContent={invalidateGeneratedLesson}
        lessonId={id}
        lessonKind={view.lessonKind}
        lessonSlug={lesson.slug}
        lessonTitle={lessonMeta.title}
      >
        <GenerationExitLink href={backHref} shortcut="Esc" width="content">
          {backLabel}
        </GenerationExitLink>
      </GenerationClient>
    ) : null;

  return (
    <Container variant="narrow">
      <ContainerBody>
        <SubscriptionGate
          backHref={backHref}
          backLabel={backLabel}
          hasAccess={view.status === "ready"}
        >
          {content}
        </SubscriptionGate>
      </ContainerBody>
    </Container>
  );
}

export function GenerateLessonFallback() {
  return (
    <Container variant="narrow">
      <ContainerBody>
        <Skeleton className="h-64 w-full rounded-xl" />
      </ContainerBody>
    </Container>
  );
}
