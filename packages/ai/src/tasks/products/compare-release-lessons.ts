import "server-only";
import { toPlainLine } from "@zoonk/utils/text-repairs";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { failFilteredAnswer, failUnfinishedAnswer } from "../_utils/filtered-answer";
import { fillPromptLanguages } from "../_utils/prompt-language";
import promptTemplate from "./compare-release-lessons.prompt.md";

/** Terra and Flash both scored 10 on the compare-release-lessons eval (6 Nov 2026); Terra cost less and answered faster. */
const defaultModel = "openai/gpt-6.1-terra";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

/** A major release's notes fit; the rest of a long changelog page is older releases. */
const MAX_NOTES_CHARACTERS = 60_000;

const WHATS_NEW_LEVELS = ["beginner", "intermediate", "advanced"] as const;

const schema = z.object({
  changed: z.array(z.object({ change: z.string(), lesson: z.int() })),
  whatsNew: z
    .object({
      level: z.enum(WHATS_NEW_LEVELS),
      offer: z.string(),
      skills: z.array(z.object({ description: z.string(), name: z.string() })),
      title: z.string(),
    })
    .nullable(),
});

type RawComparison = z.infer<typeof schema>;

export type ReleaseComparison = {
  changed: { change: string; lesson: number }[];
  whatsNew: NonNullable<RawComparison["whatsNew"]> | null;
};

type ReleaseLesson = { canDo: string | null; ideas: string[]; title: string };

export type CompareReleaseLessonsParams = {
  /** The course's language, which the chapter title, offer and skills are written in. */
  language: string;
  product: string;
  from: string | null;
  to: string;
  releaseNotes: string;
  /** Numbered from 1 in this order; `changed` cites a lesson by its number. */
  lessons: ReleaseLesson[];
  model?: string;
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  analytics?: AiGenerationContext;
};

function formatLessons(lessons: readonly ReleaseLesson[]): string {
  if (lessons.length === 0) {
    return "none";
  }

  return lessons
    .map((lesson, index) =>
      [
        `${index + 1}. ${lesson.title}`,
        lesson.canDo && `   Can do: ${lesson.canDo}`,
        lesson.ideas.length > 0 && `   Ideas: ${lesson.ideas.join("; ")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
}

function keepSkills(skills: readonly { description: string; name: string }[]) {
  const plain = skills
    .map((skill) => ({
      description: toPlainLine(skill.description),
      name: toPlainLine(skill.name),
    }))
    .filter((skill) => skill.name !== "");

  return plain.filter(
    (skill, index) =>
      plain.findIndex((other) => other.name.toLowerCase() === skill.name.toLowerCase()) === index,
  );
}

function repairWhatsNew(whatsNew: RawComparison["whatsNew"]): ReleaseComparison["whatsNew"] {
  if (!whatsNew) {
    return null;
  }

  const skills = keepSkills(whatsNew.skills);
  const title = toPlainLine(whatsNew.title);

  return skills.length > 0 && title
    ? { ...whatsNew, offer: toPlainLine(whatsNew.offer), skills, title }
    : null;
}

/** Keeps lessons that exist, each once, and repairs text flaws instead of failing over them. */
function repairReleaseComparison({
  lessonCount,
  raw,
}: {
  lessonCount: number;
  raw: RawComparison;
}): ReleaseComparison {
  const known = raw.changed.filter((entry) => entry.lesson >= 1 && entry.lesson <= lessonCount);

  return {
    changed: known
      .filter((entry, index) => known.findIndex((other) => other.lesson === entry.lesson) === index)
      .map((entry) => ({ change: toPlainLine(entry.change), lesson: entry.lesson })),
    whatsNew: repairWhatsNew(raw.whatsNew),
  };
}

/** The release notes and lessons are public Library content, so it may use any provider. */
export async function compareReleaseLessons({
  analytics,
  from,
  language,
  lessons,
  model = defaultModel,
  product,
  reasoning,
  releaseNotes,
  serviceTier,
  to,
  useFallback = true,
}: CompareReleaseLessonsParams) {
  const systemPrompt = fillPromptLanguages({
    learnerLanguage: language,
    targetLanguage: language,
    template: promptTemplate,
  });

  const userPrompt = [
    `PRODUCT: ${product}`,
    `FROM: ${from ?? "none (the course names no release)"}`,
    `TO: ${to}`,
    `LESSONS:\n${formatLessons(lessons)}`,
    formatUntrustedInput({ RELEASE_NOTES: releaseNotes.slice(0, MAX_NOTES_CHARACTERS) }),
  ].join("\n\n");

  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      failUnfinishedAnswer(
        generateText({
          instructions: systemPrompt,
          model,
          output: Output.object({ schema }),
          prompt: userPrompt,
          providerOptions,
          reasoning,
        }),
      ),
    libraryInput: true,
    systemPrompt,
    task: "compare-release-lessons",
  });

  failFilteredAnswer(result);

  return {
    data: repairReleaseComparison({ lessonCount: lessons.length, raw: result.output }),
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt,
  };
}
