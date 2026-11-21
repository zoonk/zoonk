const MAX_SCORE = 10;
const MIN_SCORE = 1;

export function listeningVerdict({
  flags,
  language,
  wordCount,
}: {
  flags: { model: string; words: string[] }[];
  language: string;
  wordCount: number;
}) {
  const votes = new Map<string, Set<string>>();

  for (const { model, words } of flags) {
    const provider = model.split("/", 1)[0] ?? model;

    for (const word of words) {
      const normalized = word.normalize("NFC").toLocaleLowerCase(language);
      const providers = votes.get(normalized) ?? new Set<string>();
      providers.add(provider);
      votes.set(normalized, providers);
    }
  }

  const confirmed = [...votes].filter(([, providers]) => providers.size >= 2);

  const unconfirmed = [...votes]
    .filter(([, providers]) => providers.size === 1)
    .map(([word]) => word);

  const readRight = confirmed.length === 0;

  if (readRight && unconfirmed.length > 0) {
    return { score: null, status: "Needs a listen", unconfirmed };
  }

  const heardRight =
    wordCount === 0
      ? Number(readRight)
      : (wordCount - Math.min(confirmed.length, wordCount)) / wordCount;

  const score = Math.max(MIN_SCORE, Math.round(MAX_SCORE * heardRight * 10) / 10);
  const status = readRight ? "Read right" : "Confirmed misread";

  return { readRight, score, status, unconfirmed };
}
