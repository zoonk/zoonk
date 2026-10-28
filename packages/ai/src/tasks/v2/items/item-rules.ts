import { selectPromptVariants } from "../../_utils/prompt-variants";
import itemRulesTemplate from "./item-rules.prompt.md";
import essayRules from "./item-rules/essay.prompt.md";
import fieldRule from "./item-rules/field.prompt.md";
import languageGoalRules from "./item-rules/language-goals.prompt.md";
import matchPairsRules from "./item-rules/match-pairs.prompt.md";
import multipleChoiceRules from "./item-rules/multiple-choice.prompt.md";
import numericPictureRule from "./item-rules/numeric-pictures.prompt.md";
import numericRules from "./item-rules/numeric.prompt.md";
import orderRules from "./item-rules/order.prompt.md";
import pictureRules from "./item-rules/pictures.prompt.md";
import trueFalseRules from "./item-rules/true-false.prompt.md";
import typedQuestionRules from "./item-rules/typed-question.prompt.md";
import typedSpokenRules from "./item-rules/typed-spoken.prompt.md";
import { GENERATED_ITEM_SCHEMAS, type ItemFormat } from "./item-schemas";

export type ItemRulesScope = {
  formats: readonly ItemFormat[];
  field: boolean;
  languageGoal: boolean;
  numericEntry?: boolean;
  /** By default when their formats can. A set's questions share the set's stimulus instead. */
  pictures?: boolean;
  severalPicks?: boolean;
};

const typedRules = typedSpokenRules.replace("{{TYPED_QUESTION}}\n", () => typedQuestionRules);

const FORMAT_RULES: readonly { formats: readonly ItemFormat[]; rules: string }[] = [
  { formats: ["multipleChoice"], rules: multipleChoiceRules },
  { formats: ["trueFalse"], rules: trueFalseRules },
  { formats: ["typed", "spoken"], rules: typedRules },
  { formats: ["essay"], rules: essayRules },
  { formats: ["matchPairs"], rules: matchPairsRules },
  { formats: ["order"], rules: orderRules },
  { formats: ["numeric"], rules: numericRules },
];

const LANGUAGE_GOAL_EXCEPTION =
  ', except the language practiced in a language goal (see "Language goals")';

const LANGUAGE_GOAL_CHECK = " (in a language goal, the practiced language is in `TARGET_LANGUAGE`)";

function showsPictures(format: ItemFormat): boolean {
  return "image" in GENERATED_ITEM_SCHEMAS[format].shape;
}

function formatRules(formats: readonly ItemFormat[]): string {
  return FORMAT_RULES.filter((entry) => entry.formats.some((format) => formats.includes(format)))
    .map((entry) => entry.rules.trim())
    .join("\n\n");
}

function pictureRulesFor({
  formats,
  pictures = formats.some((format) => showsPictures(format)),
}: Pick<ItemRulesScope, "formats" | "pictures">): string {
  return [pictures ? pictureRules : "", formats.includes("numeric") ? numericPictureRule : ""]
    .filter(Boolean)
    .map((rules) => `${rules.trim()}\n`)
    .join("");
}

function buildItemRules({
  field,
  formats,
  languageGoal,
  numericEntry = false,
  pictures,
  severalPicks = false,
}: ItemRulesScope): string {
  const rules = itemRulesTemplate
    .replace("{{FIELD_RULE}}", () => (field ? ` ${fieldRule.trim()}` : ""))
    .replace("{{LANGUAGE_GOAL_EXCEPTION}}", () => (languageGoal ? LANGUAGE_GOAL_EXCEPTION : ""))
    .replace("{{LANGUAGE_GOALS}}\n\n", () =>
      languageGoal ? `${languageGoalRules.trim()}\n\n` : "",
    )
    .replace("{{PICTURES}}\n", () => pictureRulesFor({ formats, pictures }))
    .replace("{{FORMATS}}", () => formatRules(formats))
    .replace("{{LANGUAGE_GOAL_CHECK}}", () => (languageGoal ? LANGUAGE_GOAL_CHECK : ""));

  return selectPromptVariants({
    template: rules,
    variants: { numericEntry, onePick: !severalPicks, severalPicks },
  });
}

export function withItemRules(taskPrompt: string, scope: ItemRulesScope): string {
  return `${taskPrompt}\n${buildItemRules(scope)}`;
}
