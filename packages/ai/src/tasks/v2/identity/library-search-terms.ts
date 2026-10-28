import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { type LibraryIdentitySubject, formatIdentitySubject } from "./library-identity-subject";
import systemPrompt from "./library-search-terms.prompt.md";

/**
 * Luna found as many items at minimal reasoning as at its default, in 2.2s p50 instead of 3.3s (7
 * Oct 2026); these calls sit on a new goal's path to its first question.
 */
const defaultModel = "openai/gpt-6-luna";
const defaultReasoning: Reasoning = "minimal";
const fallbackModels = ["google/gemini-3.5-flash-lite", "anthropic/claude-haiku-5.5"] as const;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the model names the item before writing its terms. */
const schema = z.object({
  items: z.array(z.object({ item: z.number().int(), terms: z.array(z.string()) })),
});
/* oxlint-enable eslint/sort-keys */

/** In the order of the subjects asked for; none for one the model left out. */
export type SearchTermsData = { subjects: { terms: string[] }[] };

export type SearchTermsParams = {
  subjects: LibraryIdentitySubject[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatSubjects(subjects: readonly LibraryIdentitySubject[]): string {
  return subjects
    .map((subject, index) => `ITEM ${index + 1}:\n${formatIdentitySubject(subject)}`)
    .join("\n\n");
}

/**
 * Terms are matched back by the item's number, never by position, so an answer in another order
 * can't give one item another's terms. Terms written twice for one number are kept together.
 */
function toSubjectTerms({
  items,
  subjects,
}: {
  items: z.infer<typeof schema>["items"];
  subjects: readonly LibraryIdentitySubject[];
}): SearchTermsData {
  return {
    subjects: subjects.map((_, index) => ({
      terms: items.filter((entry) => entry.item === index + 1).flatMap((entry) => entry.terms),
    })),
  };
}

/**
 * Favors recall: the database filters by language and level, and the reuse decision rejects
 * anything that only looks similar.
 */
export async function generateSearchTerms({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  subjects,
  useFallback = true,
}: SearchTermsParams) {
  const userPrompt = formatUntrustedInput({ ITEMS: formatSubjects(subjects) });
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "library-search-terms",
  });

  const data = toSubjectTerms({ items: result.output.items, subjects });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
