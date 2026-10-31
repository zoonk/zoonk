/** Japanese, Korean and Turkish put the verb last, so a can-do line ends in its form; an order ("してください", "하세요") doesn't. */
const CAN_DO_ENDINGS: Readonly<Record<string, RegExp>> = {
  ja: /る$/u,
  ko: /수 있어요$/u,
  tr: /m[ae]k$/u,
};

export function findVerbFormProblems({
  language,
  texts,
}: {
  language: string | null;
  texts: readonly string[];
}): string[] {
  const ending = language ? CAN_DO_ENDINGS[language] : undefined;

  if (!ending) {
    return [];
  }

  return texts
    .filter((text) => !ending.test(text.trim().replace(/[。.!！]+$/u, "")))
    .map((text) => `"${text}" isn't worded as ${language}'s can-do form.`);
}
