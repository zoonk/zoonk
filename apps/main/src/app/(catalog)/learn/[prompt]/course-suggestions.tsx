import { ContentFeedback } from "@/components/feedback/content-feedback";
import { generateCourseSuggestions } from "@/data/courses/course-suggestions";
import { getSession } from "@zoonk/core/users/session/get";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { ItemGroup } from "@zoonk/ui/components/item";
import { normalizeString } from "@zoonk/utils/string";
import { getExtracted, getLocale } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CourseSuggestionItem } from "./course-suggestion-item";

type AutomaticCourseSuggestion = { id: string; title: string };

/**
 * The learn results page should only ask learners to choose when there is a real
 * choice to make. A single suggestion or an exact title match means the prompt
 * already identifies one course, so returning that suggestion lets the page send
 * the learner straight into course generation.
 */
function getAutomaticCourseSuggestion({
  prompt,
  suggestions,
}: {
  prompt: string;
  suggestions: AutomaticCourseSuggestion[];
}): AutomaticCourseSuggestion | null {
  if (suggestions.length === 1) {
    return suggestions[0] ?? null;
  }

  const normalizedPrompt = normalizeString(prompt);

  return (
    suggestions.find((suggestion) => normalizeString(suggestion.title) === normalizedPrompt) ?? null
  );
}

export async function CourseSuggestions({ prompt }: { prompt: string }) {
  const locale = await getLocale();
  const t = await getExtracted();

  const [session, { suggestions }] = await Promise.all([
    getSession(),
    generateCourseSuggestions({ language: locale, prompt }),
  ]);

  const automaticSuggestion = getAutomaticCourseSuggestion({ prompt, suggestions });

  if (automaticSuggestion) {
    redirect(`/generate/cs/${automaticSuggestion.id}`);
  }

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
        defaultEmail={session?.user.email}
        feedbackTarget={{ kind: "courseSuggestions", locale, prompt }}
      />
    </Container>
  );
}
