import {
  type CategoryScore,
  type CategoryScoreSummary,
  type JudgeCategoryScore,
  type ScoreCategory,
} from "./types";

function validateScoreCategories(categories: ScoreCategory[]): void {
  if (categories.length === 0) {
    throw new Error("Score categories cannot be empty.");
  }

  const categoryIds = new Set<string>();

  for (const category of categories) {
    if (categoryIds.has(category.id)) {
      throw new Error(`Duplicate score category: ${category.id}`);
    }

    if (category.weight <= 0) {
      throw new Error(`Score category ${category.id} must have a positive weight.`);
    }

    categoryIds.add(category.id);
  }

  const totalWeight = categories.reduce((total, category) => total + category.weight, 0);

  if (Math.abs(totalWeight - 100) > 0.001) {
    throw new Error(`Score category weights must total 100. Received: ${totalWeight}.`);
  }
}

/** Formats task-level dimensions as an explicit, independently scored judge rubric. */
export function formatScoreCategories(categories: ScoreCategory[]): string {
  validateScoreCategories(categories);

  return categories
    .map(
      (category) =>
        `### ${category.label}\n- Category ID: \`${category.id}\`\n- Weight: ${category.weight}%\n- Expectations: ${category.expectations}`,
    )
    .join("\n\n");
}

/** Persists the full human-readable rubric used for a categorized judgment. */
export function formatExpectationsWithCategories({
  categories,
  expectations,
}: {
  categories?: ScoreCategory[];
  expectations: string;
}): string {
  return categories
    ? `${expectations}\n\nSCORE CATEGORIES:\n\n${formatScoreCategories(categories)}`
    : expectations;
}

/**
 * Rejects incomplete or invented category IDs at the model-output boundary and
 * snapshots the configured labels and weights into the persisted score.
 */
export function resolveCategoryScores({
  categories,
  judgeScores,
}: {
  categories: ScoreCategory[];
  judgeScores: JudgeCategoryScore[];
}): CategoryScore[] {
  validateScoreCategories(categories);

  const judgeScoresById = new Map<string, JudgeCategoryScore>();

  for (const judgeScore of judgeScores) {
    if (judgeScoresById.has(judgeScore.categoryId)) {
      throw new Error(`Judge returned duplicate score category: ${judgeScore.categoryId}`);
    }

    judgeScoresById.set(judgeScore.categoryId, judgeScore);
  }

  const configuredCategoryIds = new Set(categories.map((category) => category.id));

  const unknownCategory = judgeScores.find(
    (judgeScore) => !configuredCategoryIds.has(judgeScore.categoryId),
  );

  if (unknownCategory) {
    throw new Error(`Judge returned unknown score category: ${unknownCategory.categoryId}`);
  }

  return categories.map((category) => {
    const judgeScore = judgeScoresById.get(category.id);

    if (!judgeScore) {
      throw new Error(`Judge omitted score category: ${category.id}`);
    }

    return { ...judgeScore, label: category.label, weight: category.weight };
  });
}

/** Averages persisted category scores while retaining their display metadata. */
export function summarizeCategoryScores(
  scoreGroups: (CategoryScore[] | undefined)[],
): CategoryScoreSummary[] {
  const groupedScores = new Map<string, { label: string; scores: number[]; weight: number }>();

  for (const scores of scoreGroups) {
    for (const score of scores ?? []) {
      const group = groupedScores.get(score.categoryId) ?? {
        label: score.label,
        scores: [],
        weight: score.weight,
      };

      group.scores.push(score.score);
      groupedScores.set(score.categoryId, group);
    }
  }

  return [...groupedScores.entries()].map(([categoryId, group]) => ({
    categoryId,
    label: group.label,
    score: group.scores.reduce((total, score) => total + score, 0) / group.scores.length,
    weight: group.weight,
  }));
}
