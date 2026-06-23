import { GenerationExitLink } from "@/components/generation/generation-exit-link";
import { getCourseStartRequestById } from "@/data/courses/course-start-request";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Empty, EmptyContent, EmptyHeader } from "@zoonk/ui/components/empty";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getExtracted } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { GenerationClient } from "./generation-client";

export async function GenerateCourseStartRequestContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await getCourseStartRequestById(id);

  if (!request?.canonicalTitle || !request.generationStatus) {
    notFound();
  }

  const linkedCourse = request.course;

  if (linkedCourse?.generationStatus === "completed") {
    redirect(`/b/${AI_ORG_SLUG}/c/${linkedCourse.slug}`);
  }

  const t = await getExtracted();

  const courseSlug = getCourseSlugForTitle({
    language: request.language,
    title: request.canonicalTitle,
  });

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{request.canonicalTitle}</ContainerTitle>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <GenerationClient
          courseSlug={courseSlug}
          linkedCourseSlug={linkedCourse?.slug ?? null}
          generationRunId={request.generationRunId}
          generationStatus={request.generationStatus}
          requestId={id}
        />
        <GenerationExitLink href="/">{t("Back home")}</GenerationExitLink>
      </ContainerBody>
    </Container>
  );
}

export function GenerateCourseStartRequestFallback() {
  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-1 h-4 w-72" />
        </ContainerHeaderGroup>
      </ContainerHeader>

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
