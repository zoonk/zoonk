import { FatalError } from "workflow";
import { getCourseSuggestionById } from "@/data/courses/course-suggestions";

type Input = { id: number; title: string };
type Output = { locale: string };

export async function getCourseSuggestionStep(input: Input): Promise<Output> {
  "use step";

  const suggestion = await getCourseSuggestionById(input.id);

  if (!suggestion) {
    throw new FatalError(`Course suggestion not found: ${input.id}`);
  }

  const match = suggestion.suggestions.find((s) => s.title === input.title);

  if (!match) {
    throw new FatalError(
      `Title "${input.title}" not found in suggestion ${input.id}`,
    );
  }

  return { locale: suggestion.locale };
}
