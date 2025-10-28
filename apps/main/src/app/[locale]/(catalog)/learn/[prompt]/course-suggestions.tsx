import { fetchCourseSuggestions } from "@zoonk/api/course-suggestions";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  Container,
  ContainerHeader,
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
import { getTranslations } from "next-intl/server";
import { Fragment } from "react/jsx-runtime";
import { ContentFeedback } from "@/components/content-feedback";
import { Link } from "@/i18n/navigation";

interface CourseSuggestionsProps {
  locale: string;
  prompt: string;
}

export async function CourseSuggestions({
  locale,
  prompt,
}: CourseSuggestionsProps) {
  const t = await getTranslations("LearnResults");
  const suggestions = await fetchCourseSuggestions({ locale, prompt });

  return (
    <Container className="mx-auto w-full max-w-2xl">
      <ContainerHeader className="text-center">
        <ContainerTitle>{t("title", { prompt })}</ContainerTitle>

        <Link className={buttonVariants({ variant: "link" })} href="/learn">
          {t("changeAction")}
        </Link>
      </ContainerHeader>

      <ItemGroup>
        {suggestions.map((course, index) => (
          <Fragment key={course.title}>
            <Item>
              <ItemContent className="gap-0.5">
                <ItemTitle>{course.title}</ItemTitle>
                <ItemDescription>{course.description}</ItemDescription>
              </ItemContent>

              <ItemActions>
                <Button size="sm" variant="outline">
                  {t("createCourse")}
                </Button>
              </ItemActions>
            </Item>

            {index !== suggestions.length - 1 && <ItemSeparator />}
          </Fragment>
        ))}
      </ItemGroup>

      <ContentFeedback
        className="py-4"
        contentId={`${locale}:${prompt}`}
        kind="courseSuggestions"
      />
    </Container>
  );
}
