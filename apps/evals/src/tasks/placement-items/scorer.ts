import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import {
  type PlacementItemsParams,
  type PlacementSkillItems,
} from "@zoonk/ai/tasks/v2/items/placement-items";
import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { checkItem } from "@zoonk/core/library/items/checks";
import { GENERATE_ITEMS_SCORE_CATEGORIES } from "../generate-items/score-categories";

type PlacementItemsCase = Pick<
  PlacementItemsParams,
  "examFormat" | "language" | "quickCount" | "quickFormat" | "skills" | "typedCount"
>;

type RoleCheck = { passing: GeneratedItem[]; problems: string[]; wanted: number };

/** One skill's questions in one role, checked the way production checks them before storing. */
function checkRole({
  format,
  items,
  label,
  language,
  optionCount,
  wanted,
}: {
  format: GeneratedItem["format"];
  items: GeneratedItem[];
  label: string;
  language: string;
  optionCount: number | null;
  wanted: number;
}): RoleCheck {
  const checked = items.map((item, index) => ({
    item,
    problems: checkItem({ expectedFormat: format, item, language, optionCount }).map(
      (problem) => `${label} ${index + 1}: ${problem}`,
    ),
  }));

  return {
    passing: checked.filter((entry) => entry.problems.length === 0).map((entry) => entry.item),
    problems: [
      ...(items.length === wanted ? [] : [`${label}: ${items.length} instead of ${wanted}.`]),
      ...checked.flatMap((entry) => entry.problems),
    ],
    wanted,
  };
}

/** Every skill gets exactly the questions asked for, each passing the item checks. */
function checkPlacementItems(output: string, input: PlacementItemsCase): CodeCheckResult {
  const { skills } = JSON.parse(output) as { skills: PlacementSkillItems[] };

  const optionCount =
    input.quickFormat === "multipleChoice" ? (input.examFormat?.optionCount ?? null) : null;

  const perSkill = input.skills.map((skill, index) => {
    const written = skills[index] ?? { quick: [], typed: [] };

    const roles = [
      checkRole({
        format: input.quickFormat,
        items: written.quick,
        label: `${skill.name}, quick`,
        language: input.language,
        optionCount,
        wanted: input.quickCount,
      }),
      checkRole({
        format: "typed",
        items: written.typed,
        label: `${skill.name}, typed`,
        language: input.language,
        optionCount: null,
        wanted: input.typedCount,
      }),
    ];

    return { name: skill.name, roles };
  });

  const roles = perSkill.flatMap((skill) => skill.roles);

  return {
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
    passed: roles.reduce((total, role) => total + Math.min(role.passing.length, role.wanted), 0),
    problems: roles.flatMap((role) => role.problems),
    total: roles.reduce((total, role) => total + role.wanted, 0),
  };
}

/** The generate-items rubric, so batched questions score on the same scale as single-skill ones. */
export const scorePlacementItems: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkPlacementItems(value, testCase.userInput as PlacementItemsCase),
    output,
    scoreCategories: GENERATE_ITEMS_SCORE_CATEGORIES,
    testCase,
  });
