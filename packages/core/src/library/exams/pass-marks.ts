import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { getBaseLanguage } from "@zoonk/utils/languages";
import { z } from "zod";
import { type ExamStructure } from "./blueprint-contract";

const MAX_PASS_MARKS = 3;

type ExamRule = ExamStructure["rules"][number];

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

export function getPassMarks({
  blueprint,
  goal,
  structure,
}: {
  blueprint: Pick<ExamBlueprint, "language">;
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

export function listPassMarkTexts(rules: readonly Pick<ExamRule, "kind" | "text">[]): string[] {
  return [...new Set(rules.filter((rule) => isPassMark(rule)).map((rule) => rule.text))];
}

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
