import { Output, generateText } from "ai";
import "server-only";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { type ReadGrading, writtenGradingSchema } from "./blueprint-written-schema";
import { type BlueprintExtraction } from "./extract-exam-blueprint";
import taskPrompt from "./read-written-grading.prompt.md";
import { getReadingReasoning } from "./reading-reasoning";
import { type ResearchDocument, toDocumentParts } from "./research-documents";
import { listWrittenTasks, updateWrittenTasks } from "./written-task-ids";

/**
 * Its own read, since the blueprint reading's schema is at the most states Gemini serves (the
 * scoring sheet's fields there failed every reading, 26 Nov 2026). On its eval's 6 cases run twice
 * (27 Nov 2026), Flash read every task's fields right and dropped one passage, at $55/1k and 45 s
 * p50, with one 240 s timeout. GPT-6 Luna quoted every passage at $17/1k and 32 s p50 but lost the
 * Enem total in both runs and the OAB zero rules in both. Gemini 3.5 Flash Lite missed CGU's
 * rounding and OAB's criteria, and Haiku 5.5 failed the schema on 8 of 12 readings.
 */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["openai/gpt-6-luna"] as const;
const TIMEOUT_MS = 240_000;

export type WrittenGradingInput = {
  description: string;
  id: string;
  lines: number | null;
  points: number | null;
  section: string;
};

export type WrittenTaskGrading = { grading: ReadGrading; task: string };

export function listWrittenGradingInputs(extraction: BlueprintExtraction): WrittenGradingInput[] {
  return listWrittenTasks(extraction).map(({ id, section, task }) => ({
    description: task.description,
    id,
    lines: task.lines ?? null,
    points: task.points ?? null,
    section: section.name,
  }));
}

function toSchema(tasks: WrittenGradingInput[]) {
  const [task, ...otherTasks] = tasks.map(({ id }) => id);

  if (!task) {
    return null;
  }

  return z.object({
    tasks: z.array(
      z.object({ grading: writtenGradingSchema, task: z.enum([task, ...otherTasks]) }),
    ),
  });
}

function describeTask({ description, id, lines, points, section }: WrittenGradingInput): string {
  const limits = [
    points === null ? null : `at most ${points} points`,
    lines === null ? null : `at most ${lines} lines`,
  ].filter(Boolean);

  return `- ${id} (${section}): ${description}${limits.length > 0 ? ` [${limits.join(", ")}]` : ""}`;
}

function toIntro({
  documents,
  exam,
  tasks,
}: {
  documents: number;
  exam: string;
  tasks: WrittenGradingInput[];
}): string {
  return [
    `EXAM: ${exam}`,
    "TASKS:",
    ...tasks.map((task) => describeTask(task)),
    `DOCUMENTS: ${documents}`,
  ].join("\n");
}

/**
 * How the documents say each written task's answers are marked, every rule with the passage that
 * states it; `tasks` comes from the reading (`listWrittenGradingInputs`).
 */
export async function readWrittenGrading({
  analytics,
  documents,
  exam,
  model = defaultModel,
  reasoning,
  serviceTier,
  tasks,
  useFallback = true,
}: {
  analytics?: AiGenerationContext;
  documents: ResearchDocument[];
  exam: string;
  model?: string;
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  tasks: WrittenGradingInput[];
  useFallback?: boolean;
}) {
  const schema = toSchema(tasks);

  if (!schema) {
    return null;
  }

  const intro = toIntro({ documents: documents.length, exam, tasks });

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
        reasoning: getReadingReasoning({ documents, reasoning }),
        timeout: { totalMs: TIMEOUT_MS },
      }),
    libraryInput: true,
    systemPrompt: taskPrompt,
    task: "read-written-grading",
  });

  const data: WrittenTaskGrading[] = result.output.tasks;
  return { data, provenance, systemPrompt: taskPrompt, usage: result.usage, userPrompt: intro };
}

/** Each task gains the marking read for it; a task read twice keeps its first. */
export function applyWrittenGrading({
  extraction,
  found,
}: {
  extraction: BlueprintExtraction;
  found: readonly WrittenTaskGrading[];
}): BlueprintExtraction {
  const gradings = new Map(found.toReversed().map(({ grading, task }) => [task, grading]));

  return updateWrittenTasks({
    extraction,
    update: (task, id) => {
      const grading = gradings.get(id);
      return grading ? { ...task, grading } : task;
    },
  });
}
