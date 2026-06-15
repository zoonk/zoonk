import { ContentFeedback } from "@/components/feedback/content-feedback";
import { generateLearningGoalSuggestions } from "@/data/courses/course-suggestions";
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
import { getExtracted, getLocale } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CourseSuggestionItem } from "./course-suggestion-item";
import { LearningGoalMessage } from "./learning-goal-message";

export async function CourseSuggestions({ prompt }: { prompt: string }) {
  const locale = await getLocale();
  const t = await getExtracted();

  const [session, result] = await Promise.all([
    getSession(),
    generateLearningGoalSuggestions({ language: locale, prompt }),
  ]);

  if (result.kind !== "courseSuggestions") {
    return <LearningGoalMessage state={result} />;
  }

  const [onlySuggestion] = result.suggestions;

  if (result.suggestions.length === 1 && onlySuggestion) {
    redirect(`/generate/cs/${onlySuggestion.id}`);
  }

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>
            {t("Course ideas for {prompt}", { prompt: result.prompt })}
          </ContainerTitle>

          <Link href="/learn">
            <ContainerDescription className="text-sm hover:underline">
              {t("Change goal")}
            </ContainerDescription>
          </Link>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <ItemGroup>
          {result.suggestions.map((course, index) => (
            <CourseSuggestionItem
              course={course}
              isLast={index === result.suggestions.length - 1}
              key={course.id}
            />
          ))}
        </ItemGroup>
      </ContainerBody>

      <ContentFeedback
        className="py-4"
        defaultEmail={session?.user.email}
        feedbackTarget={{
          kind: "courseSuggestions",
          locale: result.language,
          prompt: result.sourcePrompt,
        }}
      />
    </Container>
  );
}
