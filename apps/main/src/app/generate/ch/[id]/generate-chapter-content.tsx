import { GenerationExitLink } from "@/components/generation/generation-exit-link";
import { SubscriptionGate } from "@/components/subscription/subscription-gate";
import { getChapterForGeneration } from "@/data/chapters/get-chapter-for-generation";
import { getInitialGenerationPageStatus } from "@/lib/workflow/get-initial-generation-page-status";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { GenerationClient } from "./generation-client";

export async function GenerateChapterContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chapter = await getChapterForGeneration(id);

  if (!chapter) {
    notFound();
  }

  const t = await getExtracted();

  const backHref = `/b/${AI_ORG_SLUG}/c/${chapter.course.slug}` as const;
  const backLabel = t("Back to course");

  const initialStatus = getInitialGenerationPageStatus({
    generationStatus: chapter.generationStatus,
    isReadyForRedirect: chapter._count.lessons > 0,
  });

  return (
    <Container variant="narrow">
      <ContainerBody>
        <SubscriptionGate backHref={backHref} backLabel={backLabel} bypass={chapter.position === 0}>
          <GenerationClient
            chapterId={id}
            chapterSlug={chapter.slug}
            chapterTitle={chapter.title}
            courseSlug={chapter.course.slug}
            generationRunId={chapter.generationRunId}
            initialStatus={initialStatus}
          />
          <GenerationExitLink href={backHref}>{backLabel}</GenerationExitLink>
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
