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
  writerModels = [],
}: {
  reviewers: readonly [string, ...string[]];
  writerModel?: string;
  writerModels?: readonly string[];
}): { fallbackModels: string[]; model: string } {
  const writerFamilies = new Set(
    [...(writerModel ? [writerModel] : []), ...writerModels].flatMap((model) =>
      model.split(", ").map((writer) => getModelFamily(writer)),
    ),
  );

  const [model, ...fallbackModels] = reviewers.filter(
    (candidate) => !writerFamilies.has(getModelFamily(candidate)),
  );

  if (!model) {
    throw new Error("No reviewer outside the writer families is available");
  }

  return { fallbackModels, model };
}
