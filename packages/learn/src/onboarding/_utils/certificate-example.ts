import { getBaseLanguage } from "@zoonk/utils/languages";

const CERTIFICATE_EXAMPLES: Readonly<Record<string, string>> = {
  de: "Goethe-Zertifikat",
  en: "IELTS",
  es: "DELE",
  fr: "DELF",
  it: "CELI",
  ja: "JLPT",
  ko: "TOPIK",
  pt: "Celpe-Bras",
  zh: "HSK",
};

export function getCertificateExample(language: string | null): string | undefined {
  const base = language ? getBaseLanguage(language) : "";
  return Object.hasOwn(CERTIFICATE_EXAMPLES, base) ? CERTIFICATE_EXAMPLES[base] : undefined;
}
