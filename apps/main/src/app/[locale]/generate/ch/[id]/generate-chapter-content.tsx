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
import { notFound, redirect } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { LoginRequired } from "@/components/auth/login-required";
import { SubscriptionGate } from "@/components/subscription/subscription-gate";
import { getChapterForGeneration } from "@/data/chapters/get-chapter-for-generation";
import { GenerationClient } from "./generation-client";

type GenerateChapterContentProps = {
  params: Promise<{ id: string; locale: string }>;
};

export async function GenerateChapterContent({
  params,
}: GenerateChapterContentProps) {
  const { id, locale } = await params;
  const chapterId = parseNumericId(id);

  if (chapterId === null) {
    notFound();
  }

  const [session, chapter] = await Promise.all([
    getSession(),
    getChapterForGeneration(chapterId),
  ]);

  if (!chapter) {
    notFound();
  }

  const t = await getExtracted();

  if (!session) {
    return <LoginRequired title={t("Generate Chapter")} />;
  }

  if (chapter.generationStatus === "completed") {
    redirect(`/${locale}/b/${AI_ORG_SLUG}/c/${chapter.course.slug}`);
  }

  const returnUrl = `/generate/ch/${chapterId}`;

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
        <SubscriptionGate returnUrl={returnUrl}>
          <GenerationClient
            chapterId={chapterId}
            courseSlug={chapter.course.slug}
            generationRunId={chapter.generationRunId}
            generationStatus={chapter.generationStatus}
            locale={locale}
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
