import { GenerationExitLink } from "@/components/generation/generation-exit-link";
import { redirect } from "@/i18n/navigation";
import { getCoursePromptGeneration } from "@zoonk/core/courses/get-prompt-generation";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { Empty, EmptyContent, EmptyHeader } from "@zoonk/ui/components/empty";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { GenerationClient } from "./generation-client";

export async function GenerateCoursePromptContent({
  params,
}: {
  params: Promise<{ id: string; lang: string }>;
}) {
  const { id, lang: locale } = await params;
  const generation = await getCoursePromptGeneration({ coursePromptId: id });

  if (generation.status === "notFound") {
    notFound();
  }

  if (generation.status === "redirect") {
    if (generation.target.kind === "course") {
      return redirect({ href: `/b/${AI_ORG_SLUG}/c/${generation.target.courseSlug}`, locale });
    }

    return redirect({
      href: `/b/${AI_ORG_SLUG}/c/${generation.target.courseSlug}/ch/${generation.target.chapterSlug}/l/${generation.target.lessonSlug}`,
      locale,
    });
  }

  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerBody>
        <GenerationClient
          completionKind={generation.completionKind}
          courseSlug={generation.courseSlug}
          courseTitle={generation.courseTitle}
          linkedCourseSlug={generation.linkedCourseSlug}
          generationRunId={generation.generationRunId}
          generationStatus={generation.generationStatus}
          isLanguageCourse={generation.isLanguageCourse}
          requestId={generation.coursePromptId}
        >
          <GenerationExitLink href="/" width="content">
            {t("Back home")}
          </GenerationExitLink>
        </GenerationClient>
      </ContainerBody>
    </Container>
  );
}

export function GenerateCoursePromptFallback() {
  return (
    <Container variant="narrow">
      <ContainerBody>
        <Empty className="border-0">
          <EmptyHeader>
            <Skeleton className="size-10 rounded-lg" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-64" />
          </EmptyHeader>
          <EmptyContent>
            <Skeleton className="h-9 w-36 rounded-full" />
          </EmptyContent>
        </Empty>
      </ContainerBody>
    </Container>
  );
}
