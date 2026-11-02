import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";

const languageNames = new Intl.DisplayNames("en", { type: "language" });

export const LANGUAGE_FILTER_OPTIONS = SUPPORTED_LOCALES.map((value) => ({
  label: languageNames.of(value) ?? value,
  value,
}));
