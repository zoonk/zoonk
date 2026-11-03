export function getModelFamily(model: string): string {
  return model.split("/")[0] ?? model;
}

/**
 * Reviewers come from families other than the writer's, because a model tends to miss its own
 * family's mistakes. It reads the model that actually wrote, so a writer fallback changes the
 * reviewer too.
 */
export function pickReviewers({
  reviewers,
  writerModel,
}: {
  reviewers: readonly [string, ...string[]];
  writerModel: string;
}): { fallbackModels: string[]; model: string } {
  const writerFamily = getModelFamily(writerModel);

  const [model = reviewers[0], ...fallbackModels] = reviewers.filter(
    (candidate) => getModelFamily(candidate) !== writerFamily,
  );

  return { fallbackModels, model };
}
