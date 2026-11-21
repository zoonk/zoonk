import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import {
  type PlacementItemsParams,
  type PlacementSkillItems,
} from "@zoonk/ai/tasks/items/placement-items";
import { type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { checkItem, findOwnEmDashes, toCheckedItem } from "@zoonk/core/library/items/checks";
import { findNumberFormatFlaws } from "@zoonk/utils/number-format-flaws";
import { GENERATE_ITEMS_SCORE_CATEGORIES } from "../generate-items/score-categories";

type PlacementItemsCase = Pick<
  PlacementItemsParams,
  | "examFormat"
  | "language"
  | "quickCount"
  | "quickFormat"
  | "skills"
  | "targetLanguage"
  | "typedCount"
>;

type RoleCheck = {
  saveChecks: string[][];
  passing: (GeneratedItem & { itemLocator: string })[];
  problems: string[];
  wanted: number;
};

function checkRole({
  format,
  items,
  itemPath,
  label,
  language,
  optionCount,
  optionLanguage,
  wanted,
}: {
  format: GeneratedItem["format"];
  items: GeneratedItem[];
  itemPath: string;
  label: string;
  language: string;
  optionCount: number | null;
  optionLanguage: string | null | undefined;
  wanted: number;
}): RoleCheck {
  const checked = items.map((item, index) => ({
    item,
    itemLocator: `${itemPath}[${index}]`,
    problems: [
      ...checkItem({ expectedFormat: format, item, language, optionCount }),
      ...findOwnEmDashes(item),
      ...findNumberFormatFlaws({ language, value: item }),
    ].map((problem) => `${label} ${index + 1}: ${problem}`),
  }));

  const passing = checked.filter((entry) => entry.problems.length === 0);

  return {
    passing: passing.map(({ item, itemLocator }) => ({ ...item, itemLocator })),
    problems: [
      ...(items.length === wanted ? [] : [`${label}: ${items.length} instead of ${wanted}.`]),
      ...checked.flatMap((entry) => entry.problems),
    ],
    saveChecks: items.map((item, index) =>
      toCheckedItem({
        answerFormat: {},
        format,
        index,
        item,
        language,
        optionCount,
        optionLanguage,
      }).problems.map((problem) => `${label} ${index + 1}: ${problem}`),
    ),
    wanted,
  };
}

export const checkPlacementItems: TaskCodeChecks = ({ output, testCase }) => {
  const input = testCase.userInput as PlacementItemsCase;
  const { skills } = JSON.parse(output) as { skills: PlacementSkillItems[] };

  const optionCount =
    input.quickFormat === "multipleChoice" ? (input.examFormat?.optionCount ?? null) : null;

  const perSkill = input.skills.map((skill, index) => {
    const written = skills[index] ?? { quick: [], typed: [] };

    const roles = [
      checkRole({
        format: input.quickFormat,
        itemPath: `skills[${index}].quick`,
        items: written.quick,
        label: `${skill.name}, quick`,
        language: input.language,
        optionCount,
        optionLanguage: input.targetLanguage,
        wanted: input.quickCount,
      }),
      checkRole({
        format: "typed",
        itemPath: `skills[${index}].typed`,
        items: written.typed,
        label: `${skill.name}, typed`,
        language: input.language,
        optionCount: null,
        optionLanguage: input.targetLanguage,
        wanted: input.typedCount,
      }),
    ];

    return { name: skill.name, roles };
  });

  const roles = perSkill.flatMap((skill) => skill.roles);

  const saveChecks = roles.flatMap((role) => role.saveChecks);

  return {
    blockingProblems: saveChecks.every((problems) => problems.length > 0)
      ? ["No placement item passed the save checks.", ...saveChecks.flat()]
      : [],
    judgedOutput: JSON.stringify(
      {
        skills: perSkill.map(({ name, roles: [quick, typed] }) => ({
          quick: quick?.passing ?? [],
          skill: name,
          typed: typed?.passing ?? [],
        })),
      },
      null,
      2,
    ),
    keyFlawLocators: roles.flatMap((role) => role.passing.map((item) => item.itemLocator)),
    passed: roles.reduce((total, role) => total + Math.min(role.passing.length, role.wanted), 0),
    problems: roles.flatMap((role) => role.problems),
    total: roles.reduce((total, role) => total + role.wanted, 0),
  };
};

export const scorePlacementItems: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkPlacementItems({ output: value, testCase }),
    output,
    scoreCategories: GENERATE_ITEMS_SCORE_CATEGORIES,
    testCase,
  });
