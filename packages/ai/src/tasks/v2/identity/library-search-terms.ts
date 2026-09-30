import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { type LibraryIdentitySubject, formatIdentitySubject } from "./library-identity-subject";
import systemPrompt from "./library-search-terms.prompt.md";

const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite", "anthropic/claude-haiku-4.5"] as const;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the model names the item before writing its terms. */
const schema = z.object({
  items: z.array(z.object({ item: z.number().int(), terms: z.array(z.string()) })),
});
/* oxlint-enable eslint/sort-keys */

/** Each subject's terms, in the order of the subjects asked for; none for one the model left out. */
export type SearchTermsData = { subjects: { terms: string[] }[] };

export type SearchTermsParams = {
  /** The items to find, from one caller at one time, such as a chapter's lessons. */
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
 * Writes the search terms that find existing Library items before new ones are generated, for
 * every item a caller needs at once in one call, so the instructions are read once instead of
 * once per item. This step favors recall: the database filters by language and level, and the
 * reuse decision rejects anything that only looks similar.
 */
export async function generateSearchTerms({
  analytics,
  model = defaultModel,
  reasoning,
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
    systemPrompt,
    task: "library-search-terms",
  });

  const data = toSubjectTerms({ items: result.output.items, subjects });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
