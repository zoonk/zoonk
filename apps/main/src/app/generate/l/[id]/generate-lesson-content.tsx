import { LoginRequired } from "@/components/auth/login-required";
import { GenerationExitLink } from "@/components/generation/generation-exit-link";
import { SubscriptionGate } from "@/components/subscription/subscription-gate";
import { getLessonForGeneration } from "@/data/lessons/get-lesson-for-generation";
import { getLessonDisplayMeta } from "@/lib/lessons";
import { getInitialGenerationPageStatus } from "@/lib/workflow/get-initial-generation-page-status";
import { getLessonAccessRequirement } from "@zoonk/core/lessons/access";
import {
  getGeneratedCompanionForSourceLesson,
  getSourceLessonForGeneratedCompanion,
  isGeneratedCompanionLessonKind,
} from "@zoonk/core/lessons/generated-companions";
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
import { notFound, redirect } from "next/navigation";
import { GenerationClient } from "./generation-client";
import { isGeneratedLessonKind } from "./generation-phase-config";

type LessonForGeneration = NonNullable<Awaited<ReturnType<typeof getLessonForGeneration>>>;

async function GeneratedCompanionRedirect({ lesson }: { lesson: LessonForGeneration }) {
  const sourceLesson = await getSourceLessonForGeneratedCompanion(lesson);

  if (!sourceLesson) {
    notFound();
  }

  redirect(`/generate/l/${sourceLesson.id}`);

  return null;
}

export async function GenerateLessonContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, lesson] = await Promise.all([getSession(), getLessonForGeneration(id)]);

  if (!lesson || !isGeneratedLessonKind(lesson.kind)) {
    notFound();
  }

  const t = await getExtracted();

  const backHref =
    `/b/${AI_ORG_SLUG}/c/${lesson.chapter.course.slug}/ch/${lesson.chapter.slug}` as const;

  const backLabel = t("Back to chapter");

  const accessRequirement = getLessonAccessRequirement({
    isAuthenticated: Boolean(session),
    lesson,
  });

  if (accessRequirement === "authentication") {
    return <LoginRequired backHref={backHref} backLabel={backLabel} title={t("Create Lesson")} />;
  }

  const lessonMeta = await getLessonDisplayMeta(lesson);
  const companionLesson = await getGeneratedCompanionForSourceLesson(lesson);

  const hasIncompleteCompanion =
    companionLesson?.generationStatus === "pending" ||
    companionLesson?.generationStatus === "failed";

  const initialStatus = getInitialGenerationPageStatus({
    generationStatus: lesson.generationStatus,
    isReadyForRedirect:
      (lesson.generationStatus === "completed" || lesson._count.steps > 0) &&
      !hasIncompleteCompanion,
  });

  const content =
    lesson.generationStatus !== "completed" && isGeneratedCompanionLessonKind(lesson.kind) ? (
      <GeneratedCompanionRedirect lesson={lesson} />
    ) : (
      <>
        <GenerationClient
          chapterSlug={lesson.chapter.slug}
          courseSlug={lesson.chapter.course.slug}
          generationRunId={lesson.generationRunId}
          initialStatus={initialStatus}
          lessonId={id}
          lessonKind={lesson.kind}
          lessonSlug={lesson.slug}
        />
        <GenerationExitLink href={backHref}>{backLabel}</GenerationExitLink>
      </>
    );

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{lessonMeta.title}</ContainerTitle>
          <ContainerDescription>{lessonMeta.description}</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <SubscriptionGate
          backHref={backHref}
          backLabel={backLabel}
          bypass={accessRequirement === "free"}
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
