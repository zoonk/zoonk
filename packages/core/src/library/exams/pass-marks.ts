import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { getBaseLanguage } from "@zoonk/utils/languages";
import { z } from "zod";
import { type ExamStructure } from "./blueprint-contract";

/** A notice may set a minimum per test and one overall; more than this is the fine print. */
const MAX_PASS_MARKS = 3;

type ExamRule = ExamStructure["rules"][number];

/**
 * What it takes to pass, as the notice says it ("Passed with at least 40 of the 80 points
 * (50%)."), with the language it says it in: the learner's when the reading translated it, the
 * notice's otherwise (DELE's Spanish, on a blueprint read before translations), so screens say
 * which language it is when it isn't theirs.
 */
export const passMarksSchema = z
  .object({
    language: z
      .string()
      .meta({
        description:
          "The language the texts are in: the learner's when the notice's words were translated, the notice's otherwise",
      }),
    texts: z.array(z.string()).min(1),
  })
  .meta({ id: "PassMarks" });

export type PassMarks = z.infer<typeof passMarksSchema>;

function isPassMark(rule: Pick<ExamRule, "kind">): boolean {
  return rule.kind === "passMark";
}

/**
 * The notice's rules read as pass marks, in its order: in the learner's language when the reading
 * translated every one of them into it, in the notice's `language` otherwise. Null for notices read
 * before rules had kinds, and for exams without a pass mark.
 */
export function getPassMarks({
  blueprint,
  goal,
  structure,
}: {
  /** The exam's blueprint, whose `language` the notice was read in. */
  blueprint: Pick<ExamBlueprint, "language">;
  /** The learner's goal, in whose language translations are said; without one, the notice's. */
  goal: Partial<Pick<Goal, "language">> | null;
  structure: ExamStructure;
}): PassMarks | null {
  const rules = structure.rules.filter((rule) => isPassMark(rule)).slice(0, MAX_PASS_MARKS);

  if (rules.length === 0) {
    return null;
  }

  const learner = goal?.language ? getBaseLanguage(goal.language) : null;
  const translated = rules.map((rule) => (learner ? rule.translations?.[learner] : undefined));

  if (learner && translated.every((text) => text !== undefined)) {
    return { language: learner, texts: translated };
  }

  return { language: blueprint.language, texts: rules.map((rule) => rule.text) };
}

/** The texts of the pass marks a reading found, for their translation into the app's languages. */
export function listPassMarkTexts(rules: readonly Pick<ExamRule, "kind" | "text">[]): string[] {
  return [...new Set(rules.filter((rule) => isPassMark(rule)).map((rule) => rule.text))];
}

/**
 * The structure's pass marks with their translations (each language's texts in the order of
 * `texts`, as `listPassMarkTexts` listed them), matched by text, since the checks may have dropped
 * some. A rule whose text wasn't translated keeps what it had.
 */
export function withPassMarkTranslations({
  structure,
  texts,
  translations,
}: {
  structure: ExamStructure;
  texts: readonly string[];
  translations: Readonly<Record<string, readonly string[]>>;
}): ExamStructure {
  const languages = Object.entries(translations);

  if (languages.length === 0) {
    return structure;
  }

  const rules = structure.rules.map((rule) => {
    const index = texts.indexOf(rule.text);

    if (!isPassMark(rule) || index === -1) {
      return rule;
    }

    const translated = languages.flatMap(([code, list]) => {
      const text = list[index];
      return text ? [[code, text] as const] : [];
    });

    return { ...rule, translations: Object.fromEntries(translated) };
  });

  return { ...structure, rules };
}
