import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import taskPrompt from "./find-domain-shares.prompt.md";
import { type ResearchDocument, toDocumentParts } from "./research-documents";

/**
 * Its own read, since the blueprint reading's schema is at the most states Gemini serves. On the
 * SAT, FE and a points-split notice run three times (28 Nov 2026), Flash-Lite and Luna read every
 * share right (Haiku 5.5 too, once), at $15.44/1k and $29.42/1k.
 */
const defaultModel = "google/gemini-3.5-flash-lite";
const fallbackModels = ["openai/gpt-6-luna"] as const;
const defaultReasoning: Reasoning = "low";
const TIMEOUT_MS = 120_000;

export type DomainShareSubject = { headings: string[]; name: string };

const rangeSchema = z.object({ max: z.number(), min: z.number() });

const schema = z.object({
  headings: z.array(
    z.object({
      basis: z.enum(["marks", "questions"]),
      document: z.number().int(),
      heading: z.string(),
      passage: z.string(),
      percent: rangeSchema.nullable(),
      questions: rangeSchema.nullable(),
      subject: z.number().int(),
    }),
  ),
});

export type DomainShareFinding = z.infer<typeof schema>["headings"][number];

function toIntro({
  documents,
  exam,
  subjects,
}: {
  documents: number;
  exam: string;
  subjects: readonly DomainShareSubject[];
}): string {
  return [
    `EXAM: ${exam}`,
    "SUBJECTS:",
    ...subjects.flatMap((subject, index) => [
      `${index + 1}. ${subject.name}`,
      ...subject.headings.map((heading) => `   - ${heading}`),
    ]),
    `DOCUMENTS: ${documents}`,
  ].join("\n");
}

/** Each heading's official share of its subject, as the documents state it; code checks each one. */
export async function findDomainShares({
  analytics,
  documents,
  exam,
  model = defaultModel,
  reasoning = defaultReasoning,
  serviceTier,
  subjects,
  useFallback = true,
}: {
  analytics?: AiGenerationContext;
  documents: ResearchDocument[];
  exam: string;
  model?: string;
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  subjects: readonly DomainShareSubject[];
  useFallback?: boolean;
}) {
  const intro = toIntro({ documents: documents.length, exam, subjects });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: taskPrompt,
        model,
        output: Output.object({ schema }),
        prompt: [
          { content: [{ text: intro, type: "text" }, ...toDocumentParts(documents)], role: "user" },
        ],
        providerOptions: buildProviderOptions({ fallbackModels, model, serviceTier, useFallback }),
        reasoning,
        timeout: { totalMs: TIMEOUT_MS },
      }),
    libraryInput: true,
    systemPrompt: taskPrompt,
    task: "find-domain-shares",
  });

  const data: DomainShareFinding[] = result.output.headings;
  return { data, provenance, systemPrompt: taskPrompt, usage: result.usage, userPrompt: intro };
}
