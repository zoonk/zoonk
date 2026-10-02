import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";

const languageNames = new Intl.DisplayNames("en", { type: "language" });

/**
 * Library content is written in the app's languages, so those are the filter's
 * values, with English names such as "Portuguese" for `pt`.
 */
export const LANGUAGE_FILTER_OPTIONS = SUPPORTED_LOCALES.map((value) => ({
  label: languageNames.of(value) ?? value,
  value,
}));
