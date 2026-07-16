import { GenerationExitLink } from "@/components/generation/generation-exit-link";
import { SubscriptionGate } from "@/components/subscription/subscription-gate";
import { getLessonForGeneration } from "@/data/lessons/get-lesson-for-generation";
import { redirect } from "@/i18n/navigation";
import { getLessonDisplayMeta } from "@/lib/lessons";
import { getInitialGenerationPageStatus } from "@/lib/workflow/get-initial-generation-page-status";
import { getLessonAccessRequirement } from "@zoonk/core/lessons/access";
import {
  getGeneratedCompanionForSourceLesson,
  getSourceLessonForGeneratedCompanion,
  isGeneratedCompanionLessonKind,
} from "@zoonk/core/lessons/generated-companions";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { GenerationClient } from "./generation-client";
import { isGeneratedLessonKind } from "./generation-phase-config";

type LessonForGeneration = NonNullable<Awaited<ReturnType<typeof getLessonForGeneration>>>;

async function GeneratedCompanionRedirect({
  lesson,
  locale,
}: {
  lesson: LessonForGeneration;
  locale: string;
}) {
  const sourceLesson = await getSourceLessonForGeneratedCompanion(lesson);

  if (!sourceLesson) {
    notFound();
  }

  return redirect({ href: `/generate/l/${sourceLesson.id}`, locale });
}

export async function GenerateLessonContent({
  params,
}: {
  params: Promise<{ id: string; lang: string }>;
}) {
  const { id, lang: locale } = await params;
  const lesson = await getLessonForGeneration(id);

  if (!lesson || !isGeneratedLessonKind(lesson.kind)) {
    notFound();
  }

  const t = await getExtracted();

  const backHref =
    `/b/${AI_ORG_SLUG}/c/${lesson.chapter.course.slug}/ch/${lesson.chapter.slug}` as const;

  const backLabel = t("Back to chapter");

  const accessRequirement = getLessonAccessRequirement({ lesson });

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
      <GeneratedCompanionRedirect lesson={lesson} locale={locale} />
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
          lessonTitle={lessonMeta.title}
        />
        <GenerationExitLink href={backHref} shortcut="Esc" width="content">
          {backLabel}
        </GenerationExitLink>
      </>
    );

  return (
    <Container variant="narrow">
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
      <ContainerBody>
        <Skeleton className="h-64 w-full rounded-xl" />
      </ContainerBody>
    </Container>
  );
}
