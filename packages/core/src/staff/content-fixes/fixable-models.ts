/** What `pnpm zoonk staff models` tells an agent it may propose, and what proposing enforces. */
export const FIXABLE_MODELS = {
  AnswerExplanation: {
    fields: ["explanation"],
    rules:
      "The explanation of a current screen's answer, or of a question still in practice. Fix it with { model, id, set: { explanation } }.",
  },
  Chapter: {
    fields: ["title", "description"],
    rules: "Public chapters only. Its address keeps its slug.",
  },
  Course: {
    fields: ["title", "description"],
    rules: "Public courses only. Its address keeps its slug.",
  },
  Item: {
    fields: [],
    rules:
      "{ model: 'Item', id, retire: true } takes a practice question out of new practice. Only one no current screen asks and that isn't in a set.",
  },
  Lesson: {
    fields: ["title", "description", "summary"],
    rules:
      "A published public lesson with no new version waiting. summary keeps its shape and its ideas in order; each idea may change only its label and text.",
  },
  Step: {
    fields: ["content"],
    rules:
      "A current screen of a published lesson; send the whole content. It keeps its fields, ids, option count and order, references and picture requests, and changes what learners read before answering or which answer is right, never both. Its saved answer explanations are deleted. { model: 'Step', id, detachPicture: true } takes the picture off this screen alone. Language screens and screens with a numeric practice question can't be fixed yet.",
  },
  StepVariant: { fields: ["content"], rules: "Same rules as its screen's content." },
} as const satisfies Record<string, { fields: readonly string[]; rules: string }>;
