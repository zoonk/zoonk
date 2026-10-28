import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import systemPrompt from "./check-exam-reading.prompt.md";
import { type ResearchDocument, toDocumentParts } from "./research-documents";

/**
 * Luna found exactly what five real readings left out at a tenth of Flash's price (9 Oct 2026);
 * it's from another family than the reading's.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

const cited = { document: z.number().int(), passage: z.string() };

const schema = z.object({
  missingSubjects: z.array(z.object({ ...cited, name: z.string() })),
  statedCounts: z.array(
    z.object({ ...cited, questions: z.number().int(), subject: z.number().int() }),
  ),
});

/** Code checks every passage. */
export type ExamReadingFindings = z.infer<typeof schema>;

export type ReadSubject = { name: string; questions: number | null };

export type CheckExamReadingParams = {
  documents: ResearchDocument[];
  exam: string;
  subjects: ReadSubject[];
  /** Null when the reading found none. */
  total: number | null;
  model?: string;
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  analytics?: AiGenerationContext;
};

/** Findings' passages are looked up in the text, and a long PDF costs a fraction as text. */
function toTextDocument(document: ResearchDocument): ResearchDocument {
  return document.text ? { ...document, file: null, images: [] } : document;
}

function formatSubjects(subjects: readonly ReadSubject[]): string {
  return subjects
    .map(
      (subject, index) =>
        `${index + 1}. ${subject.name} (questions: ${subject.questions ?? "none"})`,
    )
    .join("\n");
}

/**
 * Each finding quotes its passage, which code looks up before it counts (`findReadingProblems` in
 * core). A reading is shared by every learner of the exam, so every shared reading is checked.
 */
export async function checkExamReading({
  analytics,
  documents,
  exam,
  model = defaultModel,
  reasoning,
  serviceTier,
  subjects,
  total,
  useFallback = true,
}: CheckExamReadingParams) {
  const userPrompt = formatUntrustedInput({
    EXAM: exam,
    SUBJECTS: formatSubjects(subjects),
    TOTAL: total === null ? "" : String(total),
  });

  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: [
          {
            content: [
              { text: userPrompt, type: "text" },
              ...toDocumentParts(documents.map((document) => toTextDocument(document))),
            ],
            role: "user",
          },
        ],
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "check-exam-reading",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
