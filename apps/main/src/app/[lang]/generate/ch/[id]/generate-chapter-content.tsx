import { GenerationAuthenticationCTA } from "@/components/generation/generation-authentication-cta";
import { GenerationExitLink } from "@/components/generation/generation-exit-link";
import { getOriginalCourseHref } from "@/data/courses/course-href";
import { getPathname } from "@/i18n/navigation";
import { parseGenerationReturnTo } from "@/lib/workflow/generation-return-to";
import { getInitialGenerationPageStatus } from "@/lib/workflow/get-initial-generation-page-status";
import {
  getChapterCacheTag,
  getChapterLessonsCacheTag,
  getChapterRouteCacheTag,
  getCourseCurriculumCacheTag,
} from "@zoonk/core/cache-tags";
import { getNextLesson } from "@zoonk/core/progress/get-next-lesson";
import { getChapterGenerationView } from "@zoonk/core/workflows/chapter-generation-access";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getExtracted, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { invalidateGeneratedContent } from "../../invalidate-generated-content";
import { GenerationClient } from "./generation-client";

export async function GenerateChapterContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnTo = parseGenerationReturnTo(query.returnTo);
  const generationHref = `/generate/ch/${id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
  const access = await getChapterGenerationView(id);

  if (access.status === "notFound") {
    notFound();
  }

  if (access.status === "unauthorized") {
    const loginHref = `/login?next=${encodeURIComponent(generationHref)}` as const;

    return (
      <Container variant="narrow">
        <ContainerBody>
          <GenerationAuthenticationCTA
            loginHref={loginHref}
            target={{
              chapterSlug: access.chapterSlug,
              courseSlug: access.courseSlug,
              resource: "chapter",
            }}
          />
        </ContainerBody>
      </Container>
    );
  }

  const { chapter } = access;
  const brandSlug = chapter.course.userId ? "me" : AI_ORG_SLUG;
  const t = await getExtracted();
  const locale = await getLocale();

  const backHref = getOriginalCourseHref({ brandSlug, courseSlug: chapter.course.slug });

  const backLabel = t("Back to course");

  const initialStatus = getInitialGenerationPageStatus({
    generationStatus: chapter.generationStatus,
    isReadyForRedirect: chapter._count.lessons > 0,
  });

  const generatedChapterCacheTags = [
    getCourseCurriculumCacheTag(chapter.course.id),
    getChapterCacheTag(chapter.id),
    getChapterLessonsCacheTag(chapter.id),
    getChapterRouteCacheTag({
      brandSlug,
      chapterSlug: chapter.slug,
      courseSlug: chapter.course.slug,
    }),
  ];

  /** Invalidates only the chapter resolved by this server-rendered generation page. */
  async function invalidateGeneratedChapter() {
    "use server";

    invalidateGeneratedContent(generatedChapterCacheTags);
    const next = await getNextLesson({ scope: { chapterId: id } });

    if (!next || next.chapterId !== id || !("lessonId" in next)) {
      return null;
    }

    const href = next.canPrefetch
      ? (`/b/${brandSlug}/c/${chapter.course.slug}/ch/${chapter.slug}/l/${next.lessonSlug}` as const)
      : (`/generate/l/${next.lessonId}` as const);

    return getPathname({ href, locale });
  }

  return (
    <Container variant="narrow">
      <ContainerBody>
        <GenerationClient
          brandSlug={brandSlug}
          returnTo={returnTo}
          chapterId={id}
          chapterSlug={chapter.slug}
          chapterTitle={chapter.title}
          courseSlug={chapter.course.slug}
          generationRunId={chapter.generationRunId}
          initialStatus={initialStatus}
          invalidateContent={invalidateGeneratedChapter}
        >
          <GenerationExitLink href={returnTo ?? backHref} shortcut="Esc" width="content">
            {returnTo ? t("Back") : backLabel}
          </GenerationExitLink>
        </GenerationClient>
      </ContainerBody>
    </Container>
  );
}

export function GenerateChapterFallback() {
  return (
    <Container variant="narrow">
      <ContainerBody>
        <Skeleton className="h-64 w-full rounded-xl" />
      </ContainerBody>
    </Container>
  );
}
