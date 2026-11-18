import { splitTargetLanguage } from "@zoonk/utils/language-regions";
import { getBaseLanguage } from "@zoonk/utils/languages";

const CERTIFICATE_EXAMPLES: Readonly<Record<string, string>> = {
  de: "Goethe-Zertifikat",
  en: "IELTS",
  es: "DELE",
  fr: "DELF",
  it: "CELI",
  ja: "JLPT",
  ko: "TOPIK",
  pt: "ACTFL OPI",
  zh: "HSK",
};

const COUNTRY_EXAMPLES = new Map([
  ["pt-BR", "Celpe-Bras"],
  ["pt-PT", "CAPLE"],
]);

export function getCertificateExample({
  language,
  region,
}: {
  language: string | null;
  region?: string | null;
}): string | undefined {
  if (!language) {
    return undefined;
  }

  const base = getBaseLanguage(language);
  const country = region ?? splitTargetLanguage(language).targetRegion;
  const example = country && COUNTRY_EXAMPLES.get(`${base}-${country}`);

  return (
    example || (Object.hasOwn(CERTIFICATE_EXAMPLES, base) ? CERTIFICATE_EXAMPLES[base] : undefined)
  );
}
