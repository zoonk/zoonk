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
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { Fragment } from "react/jsx-runtime";
import { generateCourseSuggestions } from "@/data/courses/course-suggestions";
import { Link } from "@/i18n/navigation";
import { ContentFeedback } from "./content-feedback";

type CourseSuggestionsProps = {
  locale: string;
  prompt: string;
};

export async function CourseSuggestions({
  locale,
  prompt,
}: CourseSuggestionsProps) {
  const t = await getExtracted();
  const { id, suggestions } = await generateCourseSuggestions({
    locale,
    prompt,
  });

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>
            {t("Course ideas for {prompt}", { prompt })}
          </ContainerTitle>

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
            <Fragment key={course.title}>
              <Item className="px-0 py-2">
                <ItemContent className="gap-0.5">
                  <ItemTitle>{course.title}</ItemTitle>
                  <ItemDescription>{course.description}</ItemDescription>
                </ItemContent>

                <ItemActions>
                  <Link
                    className={buttonVariants({
                      className: "gap-1.5",
                      size: "sm",
                      variant: "outline",
                    })}
                    href={`/generate/cs/${id}?title=${encodeURIComponent(course.title)}`}
                    prefetch={false}
                  >
                    <SparklesIcon aria-hidden="true" className="size-4" />
                    {t("Generate")}
                  </Link>
                </ItemActions>
              </Item>

              {index !== suggestions.length - 1 && <ItemSeparator />}
            </Fragment>
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
