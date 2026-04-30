import { LoginRequired } from "@/components/auth/login-required";
import { SubscriptionGate } from "@/components/subscription/subscription-gate";
import { getLessonForGeneration } from "@/data/lessons/get-lesson-for-generation";
import { getLessonDisplayMeta } from "@/lib/lessons";
import { getInitialGenerationPageStatus } from "@/lib/workflow/get-initial-generation-page-status";
import { getBlockingLessonGenerationPrerequisite } from "@zoonk/core/lessons/generation-prerequisites";
import { getSession } from "@zoonk/core/users/session/get";
import { type GenerationStatus } from "@zoonk/db";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GenerationClient } from "./generation-client";
import { isGeneratedLessonKind } from "./generation-phase-config";

/**
 * Pending and failed lessons are the only states where a prerequisite should
 * redirect the learner elsewhere. Running lessons already have a workflow page
 * to watch, and completed lessons should redirect into the player.
 */
function shouldCheckGenerationPrerequisites({
  generationStatus,
}: {
  generationStatus: GenerationStatus;
}): boolean {
  return generationStatus === "pending" || generationStatus === "failed";
}

export async function GenerateLessonContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, lesson] = await Promise.all([getSession(), getLessonForGeneration(id)]);

  if (!lesson || !isGeneratedLessonKind(lesson.kind)) {
    notFound();
  }

  const hasStarted = lesson.generationStatus !== "pending";
  const t = await getExtracted();
  const lessonMeta = await getLessonDisplayMeta(lesson);

  const blockingPrerequisite = shouldCheckGenerationPrerequisites({
    generationStatus: lesson.generationStatus,
  })
    ? await getBlockingLessonGenerationPrerequisite(lesson)
    : null;

  const backHref =
    `/b/${AI_ORG_SLUG}/c/${lesson.chapter.course.slug}/ch/${lesson.chapter.slug}` as const;

  const backLabel = t("Back to chapter");

  const initialStatus = getInitialGenerationPageStatus({
    generationStatus: lesson.generationStatus,
    isReadyForRedirect: lesson.generationStatus === "completed" || lesson._count.steps > 0,
  });

  if (blockingPrerequisite) {
    return (
      <Container variant="narrow">
        <ContainerHeader>
          <ContainerHeaderGroup>
            <ContainerTitle>{lessonMeta.title}</ContainerTitle>
            <ContainerDescription>{lessonMeta.description}</ContainerDescription>
          </ContainerHeaderGroup>
        </ContainerHeader>

        <ContainerBody>
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SparklesIcon />
              </EmptyMedia>

              <EmptyTitle>{t("Lesson locked")}</EmptyTitle>

              <EmptyDescription>{t("Create the required lesson first.")}</EmptyDescription>
            </EmptyHeader>

            <EmptyContent>
              <Link
                className={buttonVariants({ variant: "outline" })}
                href={`/generate/l/${blockingPrerequisite.lessonId}`}
                prefetch={false}
                rel="nofollow"
              >
                <SparklesIcon data-icon="inline-start" />
                {t("Open required lesson")}
              </Link>
            </EmptyContent>
          </Empty>
        </ContainerBody>
      </Container>
    );
  }

  if (!session && !hasStarted) {
    return <LoginRequired backHref={backHref} backLabel={backLabel} title={t("Create Lesson")} />;
  }

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{lessonMeta.title}</ContainerTitle>
          <ContainerDescription>{lessonMeta.description}</ContainerDescription>
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
            lessonKind={lesson.kind}
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
