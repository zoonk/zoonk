import { getCourseSuggestionById } from "@/data/courses/course-suggestions";
import { findExistingCourse } from "@/data/courses/find-existing-course";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Empty, EmptyContent, EmptyHeader } from "@zoonk/ui/components/empty";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { parseNumericId } from "@zoonk/utils/string";
import { notFound, redirect } from "next/navigation";
import { GenerationClient } from "./generation-client";

export async function GenerateCourseSuggestionContent({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const suggestionId = parseNumericId(id);

  if (suggestionId === null) {
    notFound();
  }

  const suggestion = await getCourseSuggestionById(suggestionId);

  if (!suggestion) {
    notFound();
  }

  const existingCourse = await findExistingCourse({
    language: suggestion.language,
    slug: suggestion.slug,
  });

  if (existingCourse.data?.generationStatus === "completed") {
    redirect(`/${locale}/b/${AI_ORG_SLUG}/c/${existingCourse.data.slug}`);
  }

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{suggestion.title}</ContainerTitle>
          <ContainerDescription>{suggestion.description}</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <GenerationClient
          courseSlug={suggestion.slug}
          generationRunId={suggestion.generationRunId}
          generationStatus={suggestion.generationStatus}
          locale={locale}
          suggestionId={suggestionId}
        />
      </ContainerBody>
    </Container>
  );
}

export function GenerateCourseSuggestionFallback() {
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
