import { ContentFeedback } from "@/components/feedback/content-feedback";
import { generateCourseSuggestions } from "@/data/courses/course-suggestions";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { ItemGroup } from "@zoonk/ui/components/item";
import { getExtracted, getLocale } from "next-intl/server";
import Link from "next/link";
import { CourseSuggestionItem } from "./course-suggestion-item";

export async function CourseSuggestions({ prompt }: { prompt: string }) {
  const locale = await getLocale();
  const t = await getExtracted();
  const { suggestions } = await generateCourseSuggestions({
    language: locale,
    prompt,
  });

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Course ideas for {prompt}", { prompt })}</ContainerTitle>

          <Link href="/learn">
            <ContainerDescription className="text-sm hover:underline">
              {t("Change subject")}
            </ContainerDescription>
          </Link>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <ItemGroup>
          {suggestions.map((course, index) => (
            <CourseSuggestionItem
              course={course}
              isLast={index === suggestions.length - 1}
              key={course.id}
            />
          ))}
        </ItemGroup>
      </ContainerBody>

      <ContentFeedback
        className="py-4"
        contentId={`${locale}:${prompt}`}
        kind="courseSuggestions"
      />
    </Container>
  );
}
