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
 * The `check-exam-reading` eval on five real readings (OAB 48 with and without ethics, ENEM missing
 * a count, Câmara, SAT, 9 Oct 2026): Luna and Gemini 3.8 Flash found exactly what was left out
 * (5 of 5), Luna at a tenth of Flash's price and faster; Sonnet 5.5 did too at nearly 30 times
 * Luna's price, and Haiku 5.5 missed ENEM's stated count. A model of another family than the
 * reading's.
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

/** What the check found the reading left out, as the model gave it: code checks every passage. */
export type ExamReadingFindings = z.infer<typeof schema>;

/** A subject as the reading listed it, with the questions it found for it. */
export type ReadSubject = { name: string; questions: number | null };

export type CheckExamReadingParams = {
  documents: ResearchDocument[];
  /** The exam's canonical name and role, such as "OAB Unified Bar Exam, first phase". */
  exam: string;
  subjects: ReadSubject[];
  /** The exam's questions as the reading found them; null when it found none. */
  total: number | null;
  model?: string;
  reasoning?: Reasoning;
  /** The gateway tier it answers at (see `chooseServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  analytics?: AiGenerationContext;
};

/**
 * A document as the check reads it: its text when it has some, which is what every finding's
 * passage is looked up in, and what makes a long PDF a fraction of its price as a file.
 */
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
 * Checks a reading of an exam's documents for what it left out: a discipline the documents say
 * the test covers that the subject list lacks (a live reading of the OAB's 48th exam notice listed 19
 * subjects without ethics, which its own rule 3.4.1.1 names), and a subject's question count the
 * documents state that the reading lacks. Each finding quotes its passage, which code looks up
 * before it counts (`findReadingProblems` in core). The reading is shared by every learner of the
 * exam and read once, so this runs on every shared reading, at the reading's tier.
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
