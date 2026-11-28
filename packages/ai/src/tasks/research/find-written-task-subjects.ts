import { Output, generateText } from "ai";
import "server-only";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { type BlueprintExtraction } from "./extract-exam-blueprint";
import taskPrompt from "./find-written-task-subjects.prompt.md";
import { type ResearchDocument, toDocumentParts } from "./research-documents";
import { listWrittenTasks, updateWrittenTasks } from "./written-task-ids";

/**
 * Its own read, since the blueprint reading's schema is at the most states Gemini serves (a new
 * field there fails every reading). Low reasoning, like the formats read beside it. Untuned: no
 * model comparison has run on its eval yet.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;
const defaultReasoning: Reasoning = "low";
const TIMEOUT_MS = 120_000;

export type WrittenTaskInput = { description: string; id: string; section: string };

export type WrittenTaskSubjects = {
  document: number;
  passage: string;
  subjects: string[];
  task: string;
};

type Section = NonNullable<BlueprintExtraction["mock"]>["sections"][number];

/** The written tests are their own subjects too; a task is never on its own test. */
function listSubjectNames({
  extraction,
  sections,
}: {
  extraction: BlueprintExtraction;
  sections: readonly Section[];
}): string[] {
  const tests = new Set(sections.map((section) => section.name));

  const isTest = (subject: BlueprintExtraction["subjects"][number]) =>
    tests.has(subject.name) || Boolean(subject.group && tests.has(subject.group));

  return [
    ...new Set(
      extraction.subjects
        .flatMap((subject) =>
          isTest(subject) ? [] : [subject.name, subject.group, subject.choiceGroup],
        )
        .filter((name): name is string => Boolean(name?.trim())),
    ),
  ];
}

/** What the read is asked about: the reading's written tasks and the names of its subjects, groups and choices. */
export function listTaskSubjectInputs(extraction: BlueprintExtraction): {
  names: string[];
  tasks: WrittenTaskInput[];
} {
  const written = listWrittenTasks(extraction);
  const sections = [...new Set(written.map(({ section }) => section))];

  return {
    names: listSubjectNames({ extraction, sections }),
    tasks: written.map(({ id, section, task }) => ({
      description: task.description,
      id,
      section: section.name,
    })),
  };
}

function toSchema({ names, tasks }: { names: string[]; tasks: WrittenTaskInput[] }) {
  const [name, ...otherNames] = names;
  const [task, ...otherTasks] = tasks.map(({ id }) => id);

  if (!name || !task) {
    return null;
  }

  return z.object({
    tasks: z.array(
      z.object({
        document: z.number().int(),
        passage: z.string(),
        subjects: z.array(z.enum([name, ...otherNames])),
        task: z.enum([task, ...otherTasks]),
      }),
    ),
  });
}

function toIntro({
  exam,
  names,
  tasks,
  documents,
}: {
  documents: number;
  exam: string;
  names: string[];
  tasks: WrittenTaskInput[];
}): string {
  return [
    `EXAM: ${exam}`,
    "TASKS:",
    ...tasks.map(({ description, id, section }) => `- ${id} (${section}): ${description}`),
    "SUBJECTS:",
    ...names.map((name) => `- ${name}`),
    `DOCUMENTS: ${documents}`,
  ].join("\n");
}

/**
 * Which of the exam's subjects each written task's questions are on, as the documents say; `names`
 * and `tasks` come from the reading (`listTaskSubjectInputs`).
 */
export async function findWrittenTaskSubjects({
  analytics,
  documents,
  exam,
  model = defaultModel,
  names,
  reasoning = defaultReasoning,
  serviceTier,
  tasks,
  useFallback = true,
}: {
  analytics?: AiGenerationContext;
  documents: ResearchDocument[];
  exam: string;
  model?: string;
  names: string[];
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  tasks: WrittenTaskInput[];
  useFallback?: boolean;
}) {
  const schema = toSchema({ names, tasks });

  if (!schema) {
    return null;
  }

  const intro = toIntro({ documents: documents.length, exam, names, tasks });

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
    task: "find-written-task-subjects",
  });

  const data: WrittenTaskSubjects[] = result.output.tasks;
  return { data, provenance, systemPrompt: taskPrompt, usage: result.usage, userPrompt: intro };
}

/** Each task gains the subjects found for it, with the passage that says so among its own. */
export function applyWrittenTaskSubjects({
  extraction,
  found,
}: {
  extraction: BlueprintExtraction;
  found: readonly WrittenTaskSubjects[];
}): BlueprintExtraction {
  if (found.length === 0) {
    return extraction;
  }

  return updateWrittenTasks({
    extraction,
    update: (task, id) => {
      const own = found.filter((link) => link.task === id);
      const subjects = [...new Set(own.flatMap((link) => link.subjects))];

      return subjects.length === 0
        ? task
        : {
            ...task,
            passages: [
              ...task.passages,
              ...own.map(({ document, passage }) => ({ document, passage })),
            ],
            subjects,
          };
    },
  });
}
