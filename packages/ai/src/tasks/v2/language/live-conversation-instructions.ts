import { type CefrLevel } from "@zoonk/utils/cefr";
import { getPromptVersion } from "@zoonk/utils/prompt-version";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import { type GenerateConversationScenarioSchema } from "./conversation-scenario";
import template from "./live-conversation-instructions.prompt.md";
import rolePlayTemplate from "./live-conversation-role-play.prompt.md";
import toeflMockTemplate from "./live-conversation-speaking-mock-toefl.prompt.md";
import speakingMockTemplate from "./live-conversation-speaking-mock.prompt.md";
import { type SpeakingMockExam } from "./speaking-mock-bands";

/**
 * How the character talks at each level: the same limits the scenario's
 * opening line and hints follow, so the call sounds like the unit.
 */
const LEVEL_RULES: Record<CefrLevel, string> = {
  A1: "The learner is a beginner (A1). Use very short sentences of about 3 to 6 words, the most common everyday words and the present tense. Speak slowly and clearly. When a question is hard, offer a choice.",
  A2: "The learner is at A2. Use short, simple sentences of up to about 10 words and common everyday words. Simple past and future forms are fine; avoid idioms and slang. Speak slowly and clearly.",
  B1: "The learner is at B1. Use clear, natural sentences of up to about 15 words and common vocabulary. Avoid rare idioms and slang. Speak at a relaxed pace.",
  B2: "The learner is at B2. Speak naturally at a normal pace, with some less common words and everyday idioms when they fit.",
  C1: "The learner is at C1. Speak naturally and fluently, with idioms and nuance, as with a native speaker.",
  C2: "The learner is at C2. Speak exactly as you would with a native speaker.",
};

/**
 * An exam keeps its standard wording at every level. IELTS's examiner picks Part 3 questions the
 * candidate can engage with; TOEFL gives every candidate the same items, so nothing changes.
 */
const SPEAKING_MOCK_LEVEL_RULES: Record<SpeakingMockExam, (level: CefrLevel) => string> = {
  ielts: (level) =>
    `Keep the test's standard wording at every level. The candidate is around ${level}, so in Part 3 choose questions they can engage with.`,
  toefl: () =>
    "Say the sentences and questions from your notes exactly as written, at a natural pace, whatever the candidate's level: the real test gives every candidate the same items.",
};

const SPEAKING_MOCK_TEMPLATES: Record<SpeakingMockExam, string> = {
  ielts: speakingMockTemplate,
  toefl: toeflMockTemplate,
};

/** A unit's role play, or an exam's speaking mock with an examiner. */
type LiveConversationRole = { kind: "unit" } | { exam: SpeakingMockExam; kind: "speakingMock" };

export type LiveConversationInstructionsParams = LiveConversationRole & {
  scenario: GenerateConversationScenarioSchema;
  level: CefrLevel;
  /** How long the conversation lasts, from 1 to 5 minutes. */
  minutes: number;
  targetLanguage: string;
  learnerLanguage: string;
};

function getRoleRules(params: LiveConversationRole & { level: CefrLevel }) {
  if (params.kind === "unit") {
    return { levelRules: LEVEL_RULES[params.level], template: rolePlayTemplate };
  }

  return {
    levelRules: SPEAKING_MOCK_LEVEL_RULES[params.exam](params.level),
    template: SPEAKING_MOCK_TEMPLATES[params.exam],
  };
}

/**
 * The instructions change with the templates and the level rules, never with
 * a scenario, so conversations group by this version like generations group by
 * their system prompt.
 */
export const LIVE_CONVERSATION_PROMPT_VERSION = getPromptVersion({
  systemPrompt: [
    template,
    rolePlayTemplate,
    ...Object.values(SPEAKING_MOCK_TEMPLATES),
    ...Object.values(LEVEL_RULES),
    ...Object.values(SPEAKING_MOCK_LEVEL_RULES).map((rules) => rules("A1")),
  ].join("\n"),
});

/** Replacement functions keep "$" in scenario text from acting as a pattern. */
function fillTemplate(text: string, values: Readonly<Record<string, string>>): string {
  return Object.entries(values).reduce(
    (filled, [key, value]) => filled.replaceAll(`{{${key}}}`, () => value),
    text,
  );
}

function formatObjectives(objectives: GenerateConversationScenarioSchema["objectives"]): string {
  return objectives
    .map((objective) => `- "${objective.label}": ${objective.description}`)
    .join("\n");
}

function formatDuration(minutes: number): string {
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

/**
 * Writes the voice model's instructions for one live conversation: its role
 * and the scenario, how to talk at the learner's level, the objectives the
 * learner is after, and when to wrap up.
 */
export function buildLiveConversationInstructions(
  params: LiveConversationInstructionsParams,
): string {
  const { learnerLanguage, minutes, scenario, targetLanguage } = params;
  const languages = getLanguagePromptContext({ targetLanguage, userLanguage: learnerLanguage });
  const { levelRules, template: roleTemplate } = getRoleRules(params);

  const role = fillTemplate(roleTemplate, {
    CHARACTER_BRIEF: scenario.characterBrief,
    CHARACTER_NAME: scenario.character.name,
    CHARACTER_PLACE: scenario.character.place,
    CHARACTER_ROLE: scenario.character.role,
    HINTS: scenario.hints.map((hint) => `- "${hint}"`).join("\n"),
    OPENING_LINE: scenario.openingLine,
    SITUATION: scenario.situation,
    TITLE: scenario.title,
  });

  const instructions = fillTemplate(
    template.replace("{{ROLE}}", () => role.trim()),
    {
      DURATION: formatDuration(minutes),
      LEARNER_LANGUAGE: languages.userLanguageName,
      LEVEL_RULES: levelRules,
      OBJECTIVES: formatObjectives(scenario.objectives),
      TARGET_LANGUAGE: languages.targetLanguageName,
    },
  );

  return instructions.trim();
}
