import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";

const languageNames = new Intl.DisplayNames("en", { type: "language" });

export const LANGUAGE_FILTER_OPTIONS = SUPPORTED_LOCALES.map((value) => ({
  label: languageNames.of(value) ?? value,
  value,
}));

/** A language as its name ("Portuguese"), for a row or a fact; a code we don't know stays a code. */
export function languageName(code: string | null | undefined): string {
  return code ? (languageNames.of(code) ?? code) : "";
}
