import { type ModelCall, toTokenUsage } from "@/lib/types";
import { getLanguageName } from "@zoonk/utils/languages";
import { generateText } from "ai";
import template from "./learner.prompt.md";

const LEARNER_MODEL = "openai/gpt-6-luna";

export type SimulatedLearner = {
  about: string;
  /** What they do on the call, one step for each line they say. */
  plan: string[];
};

export type CallTurn = {
  speaker: "character" | "learner";
  text: string;
  objectivesMet: string[];
  /** The character said it after falling quiet, while the learner was still writing. */
  unprompted?: boolean;
};

function toEnglishName(language: string): string {
  return getLanguageName({ targetLanguage: language, userLanguage: "en" });
}

export function buildLearnerPrompt({
  learner,
  learnerLanguage,
  level,
  targetLanguage,
}: {
  learner: SimulatedLearner;
  learnerLanguage: string;
  level: string;
  targetLanguage: string;
}): string {
  const values: Record<string, string> = {
    ABOUT: learner.about,
    LEARNER_LANGUAGE: toEnglishName(learnerLanguage),
    LEVEL: level,
    PLAN: learner.plan.map((step, index) => `${index + 1}. ${step}`).join("\n"),
    TARGET_LANGUAGE: toEnglishName(targetLanguage),
  };

  return Object.entries(values).reduce(
    (prompt, [key, value]) => prompt.replaceAll(`{{${key}}}`, () => value),
    template,
  );
}

function formatCall(turns: readonly CallTurn[]): string {
  return turns
    .map((turn) => `${turn.speaker === "character" ? "CHARACTER" : "YOU"}: ${turn.text}`)
    .join("\n");
}

export async function writeLearnerLine({
  step,
  systemPrompt,
  turns,
}: {
  step: string;
  systemPrompt: string;
  turns: readonly CallTurn[];
}): Promise<{ call: ModelCall; text: string }> {
  const { text, usage } = await generateText({
    instructions: systemPrompt,
    model: LEARNER_MODEL,
    prompt: `The call so far:\n${formatCall(turns)}\n\nDo this now: ${step}`,
  });

  return { call: { modelId: LEARNER_MODEL, usage: toTokenUsage(usage) }, text: text.trim() };
}
