import { LoginRequired } from "@/components/auth/login-required";
import { SubscriptionGate } from "@/components/subscription/subscription-gate";
import { getChapterForGeneration } from "@/data/chapters/get-chapter-for-generation";
import { getSession } from "@zoonk/core/users/session/get";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { parseNumericId } from "@zoonk/utils/string";
import { getExtracted } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { GenerationClient } from "./generation-client";

export async function GenerateChapterContent({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const chapterId = parseNumericId(id);

  if (chapterId === null) {
    notFound();
  }

  const [session, chapter] = await Promise.all([getSession(), getChapterForGeneration(chapterId)]);

  if (!chapter) {
    notFound();
  }

  const isFirstChapter = chapter.position === 0;
  const t = await getExtracted();

  if (!session && !isFirstChapter) {
    return <LoginRequired title={t("Generate Chapter")} />;
  }

  if (chapter.generationStatus === "completed") {
    redirect(`/b/${AI_ORG_SLUG}/c/${chapter.course.slug}/ch/${chapter.slug}`);
  }

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{chapter.title}</ContainerTitle>
          {chapter.description && (
            <ContainerDescription>{chapter.description}</ContainerDescription>
          )}
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <SubscriptionGate bypass={isFirstChapter}>
          <GenerationClient
            chapterId={chapterId}
            chapterSlug={chapter.slug}
            courseSlug={chapter.course.slug}
            generationRunId={chapter.generationRunId}
            generationStatus={chapter.generationStatus}
            locale={locale}
            targetLanguage={chapter.course.targetLanguage}
          />
        </SubscriptionGate>
      </ContainerBody>
    </Container>
  );
}

export function GenerateChapterFallback() {
  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-1 h-4 w-72" />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Skeleton className="h-64 w-full rounded-xl" />
      </ContainerBody>
    </Container>
  );
}
