import { getTranslations } from "next-intl/server";
import { Fragment } from "react/jsx-runtime";
import { ContentFeedback } from "@/components/content-feedback";
import { PageContainer, PageHeader, PageTitle } from "@/components/pages";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Link } from "@/i18n/navigation";
import { fetchCourseSuggestions } from "@/services/course-suggestions";

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
    <PageContainer className="mx-auto w-full max-w-2xl">
      <PageHeader className="text-center">
        <PageTitle>{t("title", { prompt })}</PageTitle>

        <Link href="/learn" className={buttonVariants({ variant: "link" })}>
          {t("changeAction")}
        </Link>
      </PageHeader>

      <ItemGroup>
        {suggestions.map((course, index) => (
          <Fragment key={course.title}>
            <Item>
              <ItemContent className="gap-0.5">
                <ItemTitle>{course.title}</ItemTitle>
                <ItemDescription>{course.description}</ItemDescription>
              </ItemContent>

              <ItemActions>
                <Button variant="outline" size="sm">
                  {t("createCourse")}
                </Button>
              </ItemActions>
            </Item>

            {index !== suggestions.length - 1 && <ItemSeparator />}
          </Fragment>
        ))}
      </ItemGroup>

      <ContentFeedback
        kind="courseSuggestions"
        contentId={`${locale}:${prompt}`}
        className="py-4"
      />
    </PageContainer>
  );
}
