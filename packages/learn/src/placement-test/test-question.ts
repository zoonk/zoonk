/**
 * The question an open test asks next. Null once every question is answered and the test only
 * waits to be closed, so nothing names a question past the last one.
 */
export function toNextQuestion({
  answered,
  total,
}: {
  answered: number;
  total: number;
}): number | null {
  return answered < total ? answered + 1 : null;
}
