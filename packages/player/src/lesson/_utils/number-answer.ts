const NUMBER_ANSWER = /^(?:[\p{Lu}]{0,3}\p{Sc}\s?)?[+\-−]?\d[\d.,\s]*(?:\s?[\p{L}%°Ωµ/²³]{1,6})?$/u;

export function isNumberAnswer(acceptedAnswers?: readonly string[]): boolean {
  if (!acceptedAnswers || acceptedAnswers.length === 0) {
    return false;
  }

  return acceptedAnswers.every((answer) => NUMBER_ANSWER.test(answer.trim()));
}
