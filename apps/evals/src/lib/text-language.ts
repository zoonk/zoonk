const LANGUAGE_WORDS = {
  en: new Set([
    "the",
    "and",
    "you",
    "your",
    "to",
    "of",
    "is",
    "that",
    "with",
    "for",
    "this",
    "it",
    "are",
    "but",
    "not",
    "by",
    "be",
    "how",
    "what",
    "or",
    "from",
    "in",
    "on",
    "most",
    "question",
    "questions",
    "papers",
    "past",
    "years",
    "topics",
    "asked",
    "analysis",
  ]),
  pt: new Set([
    "de",
    "que",
    "não",
    "para",
    "uma",
    "com",
    "você",
    "seu",
    "sua",
    "os",
    "da",
    "dos",
    "das",
    "em",
    "mais",
    "mas",
    "ao",
    "na",
    "é",
    "por",
    "como",
    "ou",
    "isso",
    "sem",
    "nas",
    "nos",
    "questão",
    "questões",
    "provas",
    "anos",
    "assuntos",
    "cobrados",
    "edições",
    "análise",
  ]),
};

export function detectLanguage(text: string): "en" | "pt" | null {
  const tokens = text
    .replaceAll(/["“][^"”]*["”]/gu, " ")
    .toLowerCase()
    .split(/[^\p{L}]+/u);

  const en = tokens.filter((token) => LANGUAGE_WORDS.en.has(token)).length;
  const pt = tokens.filter((token) => LANGUAGE_WORDS.pt.has(token)).length;

  if (en === pt) {
    return null;
  }

  return en > pt ? "en" : "pt";
}
