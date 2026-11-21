import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import {
  type PlacementItemsParams,
  type PlacementSkillItems,
} from "@zoonk/ai/tasks/items/placement-items";
import { type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { checkItem, findOwnEmDashes } from "@zoonk/core/library/items/checks";
import { isTapWorthStoring } from "@zoonk/core/lookahead/placement-item-skills";
import { findNumberFormatFlaws } from "@zoonk/utils/number-format-flaws";
import { GENERATE_ITEMS_SCORE_CATEGORIES } from "../generate-items/score-categories";

type PlacementItemsCase = Pick<
  PlacementItemsParams,
  "examFormat" | "language" | "quickFormat" | "skills"
>;

const TAP_FORMATS = new Set<GeneratedItem["format"]>(["matchPairs", "multipleChoice", "order"]);

/** A tap question passes the checks the pipeline runs before storing it. */
function checkTap({ item, language }: { item: GeneratedItem; language: string }): string[] {
  if (!TAP_FORMATS.has(item.format)) {
    return [`Is ${item.format}, not a tap question.`];
  }

  return [
    ...checkItem({ item, language, select: "all" }),
    ...(isTapWorthStoring(item) ? [] : ["A blind guess passes it more than 1 time in 20."]),
  ];
}

type RoleCheck = {
  passing: (GeneratedItem & { itemLocator: string })[];
  problems: string[];
  wanted: number;
};

function checkRole({
  check,
  items,
  itemPath,
  label,
  language,
  wanted,
}: {
  check: (item: GeneratedItem) => string[];
  items: GeneratedItem[];
  itemPath: string;
  label: string;
  language: string;
  wanted: number;
}): RoleCheck {
  const checked = items.map((item, index) => ({
    item,
    itemLocator: `${itemPath}[${index}]`,
    problems: [
      ...check(item),
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
    wanted,
  };
}

function checkPlacementItems(output: string, input: PlacementItemsCase): CodeCheckResult {
  const { skills } = JSON.parse(output) as { skills: PlacementSkillItems[] };

  const optionCount =
    input.quickFormat === "multipleChoice" ? (input.examFormat?.optionCount ?? null) : null;

  const perSkill = input.skills.map((skill, index) => {
    const written = skills[index] ?? { quick: [], taps: [] };
    const shared = { language: input.language };

    const roles = [
      checkRole({
        ...shared,
        check: (item) =>
          checkItem({
            expectedFormat: input.quickFormat,
            item,
            language: input.language,
            optionCount,
          }),
        itemPath: `skills[${index}].quick`,
        items: written.quick,
        label: `${skill.name}, quick`,
        wanted: skill.quickCount,
      }),
      checkRole({
        ...shared,
        check: (item) => checkTap({ item, language: input.language }),
        itemPath: `skills[${index}].taps`,
        items: written.taps,
        label: `${skill.name}, tap`,
        wanted: skill.tapCount,
      }),
    ];

    return { name: skill.name, roles };
  });

  const roles = perSkill.flatMap((skill) => skill.roles);

  return {
    judgedOutput: JSON.stringify(
      {
        skills: perSkill.map(({ name, roles: [quick, taps] }) => ({
          quick: quick?.passing ?? [],
          skill: name,
          taps: taps?.passing ?? [],
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
}

export const scorePlacementItems: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkPlacementItems(value, testCase.userInput as PlacementItemsCase),
    output,
    scoreCategories: GENERATE_ITEMS_SCORE_CATEGORIES,
    testCase,
  });
