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

/** What a call writes, which decides the rules it reads. */
export type ItemRulesScope = {
  /** The formats the call writes. */
  formats: readonly ItemFormat[];
  /** Whether the questions are set in a field of work (`FIELD`). */
  field: boolean;
  /** Whether the skills practice a language (`TARGET_LANGUAGE`): a language goal's questions. */
  languageGoal: boolean;
  /** Whether a numeric answer box takes less than any number (`ENTRY`): whole, n decimals, a fraction. */
  numericEntry?: boolean;
  /**
   * Whether the questions show their own chart or picture; by default when their formats can. A
   * set's questions share the set's stimulus instead.
   */
  pictures?: boolean;
  /** Whether multiple choice asks the learner to pick several options (`SELECT`), not one. */
  severalPicks?: boolean;
};

/** How a typed question and its key points are written, shared with lessons' typed screens. */
const typedRules = typedSpokenRules.replace("{{TYPED_QUESTION}}\n", () => typedQuestionRules);

/** Each format's rules, in the order every writer reads them; typed and spoken share theirs. */
const FORMAT_RULES: readonly { formats: readonly ItemFormat[]; rules: string }[] = [
  { formats: ["multipleChoice"], rules: multipleChoiceRules },
  { formats: ["trueFalse"], rules: trueFalseRules },
  { formats: ["typed", "spoken"], rules: typedRules },
  { formats: ["essay"], rules: essayRules },
  { formats: ["matchPairs"], rules: matchPairsRules },
  { formats: ["order"], rules: orderRules },
  { formats: ["numeric"], rules: numericRules },
];

/** A language goal's clauses inside two rules every writer reads. */
const LANGUAGE_GOAL_EXCEPTION =
  ', except the language practiced in a language goal (see "Language goals")';

const LANGUAGE_GOAL_CHECK = " (in a language goal, the practiced language is in `TARGET_LANGUAGE`)";

/** Whether a format's items can show a chart, a timeline or a picture: its schema has them. */
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

/**
 * The rules every item writer shares (what makes a good question, exam style, text and tables, the
 * formats and the final check), with only the parts this call uses: its formats' rules, pictures
 * only for formats that show them, the field rule only for a field's questions, the language
 * goal's rules only for a language goal's, and how answers are given (several picks, a numeric
 * answer box) only when the exam asks that way. A rule still changes in one place for every writer.
 */
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

/** Every item writer's prompt: its own role and goal, then the shared rules for what it writes. */
export function withItemRules(taskPrompt: string, scope: ItemRulesScope): string {
  return `${taskPrompt}\n${buildItemRules(scope)}`;
}
