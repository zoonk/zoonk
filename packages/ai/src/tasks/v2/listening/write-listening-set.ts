import "server-only";
import { getBaseLanguage, getLanguageName } from "@zoonk/utils/languages";
import { Output, generateText } from "ai";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { formatCast } from "../../_utils/cast";
import { draftAgainWhenFlawed } from "../../_utils/draft-again";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { selectPromptVariants } from "../../_utils/prompt-variants";
import { findListeningSetProblems, repairListeningSet } from "./listening-set-checks";
import {
  LISTENING_QUESTION_FORMATS,
  type ListeningQuestionFormat,
  type ListeningSet,
  buildListeningSetSchema,
} from "./listening-set-schema";
import taskPrompt from "./write-listening-set.prompt.md";

/**
 * The item writer's model (`generate-items`), whose eval chose it for right keys and exam realism;
 * a listening set is the same work around a script.
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5"] as const;

const MIN_COUNT = 1;
const MAX_COUNT = 10;
const DEFAULT_OPTION_COUNT = 3;

export type WriteListeningSetParams = {
  /** The exam's name, such as "IELTS" or "DELE B2"; null for a school exam's English listening. */
  exam: string | null;
  /**
   * The part of the exam's listening paper, in the notice's words: "Part 1: a conversation between
   * two people in an everyday social context; form completion, no more than two words".
   */
  task: string;
  /** The language the recording and its questions are in, such as "en" or "es". */
  scriptLanguage: string;
  /** The learner's language, for the reasons and misconceptions. */
  language: string;
  /**
   * The level the questions test, as the exam names it ("B2", "band 6", "N3"); null for the level
   * the exam itself tests (an exam named for one level, or the middle of one that spans several).
   */
  level: string | null;
  count: number;
  formats: readonly ListeningQuestionFormat[];
  /** Options per multiple-choice question, as the exam prints them. */
  optionCount?: number | null;
  /**
   * The accents the exam's recordings use ("British English", "Australian English"); empty for
   * the writer to use those it knows the exam's recordings have, as the notice rarely lists them.
   */
  accents: readonly string[];
  /** How many times the exam plays the recording. */
  plays: 1 | 2;
  /**
   * The exam's listening skills the set practices (its listening area's skills); each question
   * names the one it tests. At least one.
   */
  skills: readonly { description: string; name: string }[];
  model?: string;
  /** The gateway tier it answers at (see `ServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** The formats asked for, in the writer's order; multiple choice when none is a listening format. */
function getFormats(formats: readonly ListeningQuestionFormat[]) {
  const [first = "multipleChoice", ...rest] = LISTENING_QUESTION_FORMATS.filter((format) =>
    formats.includes(format),
  );

  return [first, ...rest] as const;
}

/** The recording's language by its plain name ("English"): the accents say which variety. */
function getScriptLanguageName(language: string): string {
  return getLanguageName({ targetLanguage: getBaseLanguage(language), userLanguage: "en" });
}

/** The accents asked for, or null when the writer picks the exam's own. */
function getAccents({ accents }: WriteListeningSetParams) {
  const [first, ...rest] = accents;
  return first ? ([first, ...rest] as const) : null;
}

function formatAccents(params: WriteListeningSetParams): string {
  const accents = getAccents(params);

  return accents
    ? accents.join("; ")
    : `the ones EXAM's recordings use, as varieties of ${getScriptLanguageName(params.scriptLanguage)}`;
}

function getCount(count: number): number {
  return Math.min(Math.max(count, MIN_COUNT), MAX_COUNT);
}

function formatSkills(skills: WriteListeningSetParams["skills"]): string {
  return skills
    .map((skill, index) => `    ${index + 1}. ${skill.name}: ${skill.description}`)
    .join("\n");
}

function buildUserPrompt(params: WriteListeningSetParams): string {
  const formats = getFormats(params.formats);

  const optionCount = formats.includes("multipleChoice")
    ? `\n    OPTION_COUNT: ${params.optionCount ?? DEFAULT_OPTION_COUNT}`
    : "";

  return `
    EXAM: ${params.exam ?? "none"}
    TASK: ${params.task}
    SCRIPT_LANGUAGE: ${getScriptLanguageName(params.scriptLanguage)}
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
    LEVEL: ${params.level ?? "the level the exam tests"}
    COUNT: ${getCount(params.count)}
    FORMATS: ${formats.join(", ")}${optionCount}
    ACCENTS: ${formatAccents(params)}
    PLAYS: ${params.plays}
    SKILLS:
${formatSkills(params.skills)}
    ${formatCast({ language: params.scriptLanguage, seed: `${params.exam}:${params.task}` })}
  `;
}

function buildSystemPrompt(formats: readonly ListeningQuestionFormat[]): string {
  return selectPromptVariants({
    template: taskPrompt,
    variants: Object.fromEntries(
      LISTENING_QUESTION_FORMATS.map((format) => [format, formats.includes(format)]),
    ),
  });
}

/**
 * Writes one listening set for a part of an exam's listening paper: the script of the recording
 * (its speakers, each with an accent the exam uses, and their turns) and the questions on it, each
 * with the words of the script that answer it. Shared Library content: the input holds the exam,
 * its task and a level, never a learner's words. Code repairs what it can (stage directions, em
 * dashes, question order) and writes the set once more when flaws it can't repair remain
 * (`findListeningSetProblems`); the set comes back with any that are still there, so the caller
 * stores only clean sets. Callers run the item checks in `@zoonk/core` on each question and voice
 * the script before learners hear it.
 */
export async function writeListeningSet(params: WriteListeningSetParams) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const formats = getFormats(params.formats);

  const request = {
    count: getCount(params.count),
    formats,
    optionCount: params.optionCount ?? null,
    skillCount: params.skills.length,
  };

  const systemPrompt = buildSystemPrompt(formats);
  const userPrompt = buildUserPrompt(params);
  const schema = buildListeningSetSchema({ accents: getAccents(params), formats });
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const draft = async () => {
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
      task: "write-listening-set",
    });

    const set: ListeningSet = repairListeningSet(result.output, request);

    return {
      problems: findListeningSetProblems(set, request),
      provenance,
      set,
      usage: result.usage,
    };
  };

  const { problems, provenance, set, usage } = await draftAgainWhenFlawed({
    countProblems: (output) => output.problems.length,
    draft,
  });

  return { data: { problems, set }, provenance, systemPrompt, usage, userPrompt };
}
