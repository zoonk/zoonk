/**
 * A number, with an optional currency before it ("R$ 18") or a short unit after it ("1,5 A",
 * "350 kcal", "20%").
 */
const NUMBER_ANSWER = /^(?:[\p{Lu}]{0,3}\p{Sc}\s?)?[+\-−]?\d[\d.,\s]*(?:\s?[\p{L}%°Ωµ/²³]{1,6})?$/u;

/** Whether every accepted answer to a typed question is a number, so it takes a number field. */
export function isNumberAnswer(acceptedAnswers?: readonly string[]): boolean {
  if (!acceptedAnswers || acceptedAnswers.length === 0) {
    return false;
  }

  return acceptedAnswers.every((answer) => NUMBER_ANSWER.test(answer.trim()));
}
