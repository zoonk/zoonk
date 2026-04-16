import { LoginRequired } from "@/components/auth/login-required";
import { SubscriptionGate } from "@/components/subscription/subscription-gate";
import { getLessonForGeneration } from "@/data/lessons/get-lesson-for-generation";
import { getInitialGenerationPageStatus } from "@/lib/workflow/get-initial-generation-page-status";
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
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { GenerationClient } from "./generation-client";

export async function GenerateLessonContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, lesson] = await Promise.all([getSession(), getLessonForGeneration(id)]);

  if (!lesson) {
    notFound();
  }

  const hasStarted = lesson.generationStatus !== "pending";
  const t = await getExtracted();

  const backHref =
    `/b/${AI_ORG_SLUG}/c/${lesson.chapter.course.slug}/ch/${lesson.chapter.slug}` as const;

  const backLabel = t("Back to chapter");

  const initialStatus = getInitialGenerationPageStatus({
    generationStatus: lesson.generationStatus,
    isReadyForRedirect: lesson._count.activities > 0,
  });

  if (!session && !hasStarted) {
    return <LoginRequired backHref={backHref} backLabel={backLabel} title={t("Create Lesson")} />;
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
        <SubscriptionGate backHref={backHref} backLabel={backLabel} bypass={hasStarted}>
          <GenerationClient
            chapterSlug={lesson.chapter.slug}
            courseSlug={lesson.chapter.course.slug}
            generationRunId={lesson.generationRunId}
            initialStatus={initialStatus}
            lessonId={id}
            lessonSlug={lesson.slug}
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
