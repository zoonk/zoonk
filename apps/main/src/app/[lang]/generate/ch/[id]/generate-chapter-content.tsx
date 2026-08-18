import { GenerationAuthenticationCTA } from "@/components/generation/generation-authentication-cta";
import { GenerationExitLink } from "@/components/generation/generation-exit-link";
import { SubscriptionGate } from "@/components/subscription/subscription-gate";
import { getInitialGenerationPageStatus } from "@/lib/workflow/get-initial-generation-page-status";
import {
  getChapterCacheTag,
  getChapterLessonsCacheTag,
  getChapterRouteCacheTag,
  getCourseCurriculumCacheTag,
} from "@zoonk/core/cache-tags";
import { getChapterGenerationView } from "@zoonk/core/workflows/chapter-generation-access";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { invalidateGeneratedContent } from "../../invalidate-generated-content";
import { GenerationClient } from "./generation-client";

export async function GenerateChapterContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getChapterGenerationView(id);

  if (access.status === "notFound") {
    notFound();
  }

  if (access.status === "unauthorized") {
    const loginHref = `/login?next=${encodeURIComponent(`/generate/ch/${id}`)}` as const;

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
  const t = await getExtracted();

  const backHref = `/b/${AI_ORG_SLUG}/c/${chapter.course.slug}` as const;
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
      brandSlug: AI_ORG_SLUG,
      chapterSlug: chapter.slug,
      courseSlug: chapter.course.slug,
    }),
  ];

  /** Invalidates only the chapter resolved by this server-rendered generation page. */
  async function invalidateGeneratedChapter() {
    "use server";

    invalidateGeneratedContent(generatedChapterCacheTags);
  }

  return (
    <Container variant="narrow">
      <ContainerBody>
        <SubscriptionGate
          backHref={backHref}
          backLabel={backLabel}
          hasAccess={access.status === "ready"}
        >
          <GenerationClient
            chapterId={id}
            chapterSlug={chapter.slug}
            chapterTitle={chapter.title}
            courseSlug={chapter.course.slug}
            generationRunId={chapter.generationRunId}
            initialStatus={initialStatus}
            invalidateContent={invalidateGeneratedChapter}
          >
            <GenerationExitLink href={backHref} shortcut="Esc" width="content">
              {backLabel}
            </GenerationExitLink>
          </GenerationClient>
        </SubscriptionGate>
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
