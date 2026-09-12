import { GenerationAuthenticationCTA } from "@/components/generation/generation-authentication-cta";
import { GenerationExitLink } from "@/components/generation/generation-exit-link";
import { redirect } from "@/i18n/navigation";
import { getLessonDisplayMeta } from "@/lib/lessons";
import {
  getGenerationNavigationQuery,
  parseGenerationBackTo,
  parseGenerationReturnTo,
} from "@/lib/workflow/generation-return-to";
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
  searchParams,
}: {
  params: Promise<{ id: string; lang: string }>;
  searchParams: Promise<{ returnTo?: string | string[]; backTo?: string | string[] }>;
}) {
  const [{ id, lang: locale }, query] = await Promise.all([params, searchParams]);
  const returnTo = parseGenerationReturnTo(query.returnTo);
  const backTo = parseGenerationBackTo(query.backTo);
  const querySuffix = getGenerationNavigationQuery({ backTo, returnTo });
  const generationHref = `/generate/l/${id}${querySuffix}`;
  const view = await getLessonGenerationView(id);

  if (view.status === "notFound") {
    notFound();
  }

  if (view.status === "unauthorized") {
    const loginHref = `/login?next=${encodeURIComponent(generationHref)}` as const;

    return (
      <Container variant="narrow">
        <ContainerBody>
          <GenerationAuthenticationCTA
            loginHref={loginHref}
            target={{
              chapterSlug: view.chapterSlug,
              courseSlug: view.courseSlug,
              lessonSlug: view.lessonSlug,
              resource: "lesson",
            }}
          />
        </ContainerBody>
      </Container>
    );
  }

  if (view.status === "redirectToSource") {
    return redirect({ href: `/generate/l/${view.sourceLessonId}${querySuffix}`, locale });
  }

  const { lesson } = view;
  const brandSlug = lesson.chapter.course.userId ? "me" : AI_ORG_SLUG;
  const t = await getExtracted();

  const backHref =
    `/b/${brandSlug}/c/${lesson.chapter.course.slug}/ch/${lesson.chapter.slug}` as const;

  const backLabel = t("Back to chapter");

  const lessonMeta = view.status === "ready" ? await getLessonDisplayMeta(lesson) : null;

  const generatedLessonCacheTags = [
    getCourseCurriculumCacheTag(lesson.chapter.course.id),
    getChapterLessonsCacheTag(lesson.chapter.id),
    getLessonCacheTag(lesson.id),
    getLessonRouteCacheTag({
      brandSlug,
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
        backTo={backTo}
        brandSlug={brandSlug}
        returnTo={returnTo}
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
        <GenerationExitLink href={returnTo ?? backTo ?? backHref} shortcut="Esc" width="content">
          {returnTo ? t("Back") : backLabel}
        </GenerationExitLink>
      </GenerationClient>
    ) : null;

  return (
    <Container variant="narrow">
      <ContainerBody>{content}</ContainerBody>
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
