import { LoginRequired } from "@/components/auth/login-required";
import { SubscriptionGate } from "@/components/subscription/subscription-gate";
import { getLessonForGeneration } from "@/data/lessons/get-lesson-for-generation";
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

export async function GenerateLessonContent({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const lessonId = parseNumericId(id);

  if (lessonId === null) {
    notFound();
  }

  const [session, lesson] = await Promise.all([getSession(), getLessonForGeneration(lessonId)]);

  if (!lesson) {
    notFound();
  }

  const t = await getExtracted();

  if (!session) {
    return <LoginRequired title={t("Generate Lesson")} />;
  }

  if (lesson.generationStatus === "completed") {
    redirect(
      `/b/${AI_ORG_SLUG}/c/${lesson.chapter.course.slug}/ch/${lesson.chapter.slug}/l/${lesson.slug}`,
    );
  }

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{lesson.title}</ContainerTitle>
          <ContainerDescription>{lesson.description}</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <SubscriptionGate>
          <GenerationClient
            chapterSlug={lesson.chapter.slug}
            courseSlug={lesson.chapter.course.slug}
            generationRunId={lesson.generationRunId}
            generationStatus={lesson.generationStatus}
            lessonId={lessonId}
            lessonSlug={lesson.slug}
            locale={locale}
          />
        </SubscriptionGate>
      </ContainerBody>
    </Container>
  );
}

export function GenerateLessonFallback() {
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
