import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { toWords } from "@/lib/words";
import { type GenerateConversationScenarioSchema } from "@zoonk/ai/tasks/language/conversation-scenario";
import { normalizeString } from "@zoonk/utils/string";
import { CONVERSATION_SCENARIO_SCORE_CATEGORIES } from "./score-categories";

export type ConversationScenarioExpected = { knowsLearner: boolean };

const KNOWS_LEARNER =
  /\b(?:amig[ao]s?|colegas?|vizinh[ao]s?|vecin[ao]s?|anfitri(?:a|ao|on|ona)|companer[ao]s?|friends?|colleagues?|coworkers?|neighbou?rs?|classmates?|roommates?|host (?:family|mother|father|mom|dad|parents?))\b/u;

/** "Hi, Emma." greets Emma, while "Hi, this is Emma." and "Hi, Queen Street Apartments." don't. */
const GREETED_NAME = /^[\s¡¿]*(?:\p{L}+\s+)?\p{L}+\s*,\s*(?<name>\p{Lu}\p{Ll}+)/u;

/** Shorter place words ("the", "Rua", "de") turn up in any opening line. */
const MIN_PLACE_WORD = 4;

function knowsLearner(text: string): boolean {
  return KNOWS_LEARNER.test(toWords(text).join(" "));
}

function checkScenario({
  expected,
  output,
}: {
  expected: ConversationScenarioExpected;
  output: string;
}): CodeCheckResult {
  const { character, openingLine, situation } = JSON.parse(
    output,
  ) as GenerateConversationScenarioSchema;

  const opening = toWords(openingLine);
  const placeWords = toWords(character.place).filter((word) => word.length >= MIN_PLACE_WORD);
  const greeted = GREETED_NAME.exec(openingLine)?.groups?.name;

  const checks = [
    {
      passed: [...toWords(character.name), ...placeWords].some((word) => opening.includes(word)),
      problem: "The opening line names neither the character nor the place.",
    },
    {
      passed: !greeted || placeWords.includes(normalizeString(greeted)),
      problem: `The opening line greets ${greeted} by name.`,
    },
    {
      passed: knowsLearner(character.role) === expected.knowsLearner,
      problem: expected.knowsLearner
        ? `The role "${character.role}" doesn't already know the learner in a social moment.`
        : `The role "${character.role}" knows the learner in a service moment.`,
    },
    expected.knowsLearner && {
      passed: knowsLearner(situation),
      problem: "The situation doesn't say who the character is to the learner.",
    },
  ].filter((check) => check !== false);

  return {
    judgedOutput: output,
    passed: checks.filter((check) => check.passed).length,
    problems: checks.filter((check) => !check.passed).map((check) => check.problem),
    total: checks.length,
  };
}

export const scoreConversationScenario: TaskScorer<ConversationScenarioExpected> = ({
  output,
  testCase,
}) => {
  const { expected } = testCase;

  if (!expected) {
    throw new Error(`Conversation scenario case ${testCase.id} needs knowsLearner.`);
  }

  return scoreWithCodeChecks({
    check: (text) => checkScenario({ expected, output: text }),
    output,
    scoreCategories: CONVERSATION_SCENARIO_SCORE_CATEGORIES,
    testCase,
  });
};
