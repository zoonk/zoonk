import { getContentCurrency, getLanguageCountry, isCountryCode } from "@zoonk/utils/countries";
import { type SupportedLocale, getContentLocale, getFormattingLocale } from "@zoonk/utils/locale";
import { COUNTRY_PACKS, type CountryPack, REGISTERS } from "./country-packs";

export type ContentPlace = {
  language: string;
  /** The country the content is set in; null is the language's own country. */
  country: string | null;
};

/**
 * The one decision of which country content is set in: its own when it names one, else the one
 * content in its language has always been written for. Null for a language without one.
 */
export function resolveContentCountry({ country, language }: ContentPlace): string | null {
  return country && isCountryCode(country) ? country : getLanguageCountry(language);
}

/** The language's own country formats as the language always has; any other as the language does there. */
function getFormattingLocaleFor({ country, locale }: { country: string; locale: SupportedLocale }) {
  return country === getLanguageCountry(locale)
    ? getFormattingLocale(locale)
    : `${locale}-${country}`;
}

const SAMPLE_NUMBER = 1234.56;
const SAMPLE_DATE = new Date("2026-09-27T14:30:00Z");

function toLatexNumber(text: string): string {
  return text.replaceAll(",", "{,}").replaceAll(/[\u00A0\u202F ]/gu, String.raw`\,`);
}

function formatNumbersLine(formattingLocale: string): string {
  const number = new Intl.NumberFormat(formattingLocale).format(SAMPLE_NUMBER);
  const latex = toLatexNumber(number);

  const date = new Intl.DateTimeFormat(formattingLocale, {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(SAMPLE_DATE);

  const clock = new Intl.DateTimeFormat(formattingLocale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });

  const hours = clock.resolvedOptions().hourCycle === "h23" ? "24-hour" : "12-hour";
  const latexNote = latex === number ? "" : ` (inside LaTeX math, ${latex})`;

  return `${number}${latexNote}; dates as ${date}; ${hours} clock (${clock.format(SAMPLE_DATE)})`;
}

function formatMoneyLine({
  country,
  formattingLocale,
}: {
  country: string;
  formattingLocale: string;
}) {
  const currency = getContentCurrency(country);

  if (!currency) {
    return null;
  }

  const name = new Intl.DisplayNames(["en"], { type: "currency" }).of(currency) ?? currency;
  const written = new Intl.NumberFormat(formattingLocale, { currency, style: "currency" });

  return `${name} (${currency}), written ${written.format(SAMPLE_NUMBER)}`;
}

const BRANDS_LINE =
  "- Brands: real companies and brands, the ones above included, appear only in their ordinary use; a failure, a bug, a complaint or a mistake happens at a made-up company with a made-up name";

function formatPackLines({
  country,
  locale,
  pack,
}: {
  country: string;
  locale: SupportedLocale;
  pack: CountryPack;
}): string[] {
  const ownWriting = pack.language === locale;
  const formattingLocale = getFormattingLocaleFor({ country, locale });
  const money = ownWriting ? pack.money : formatMoneyLine({ country, formattingLocale });
  const numbers = ownWriting ? pack.numbers : formatNumbersLine(formattingLocale);

  return [
    `- Place: ${pack.place}`,
    ...(money ? [`- Money: ${money}`] : []),
    `- Numbers, dates and units: ${numbers}; ${pack.units}`,
    `- Common first names: ${pack.names}`,
    `- Cities and places: ${pack.places}`,
    `- Everyday life: ${pack.everydayLife}`,
    `- School: ${pack.school}`,
    `- National exams: ${pack.exams}`,
  ];
}

/** Only what's known for sure of a country without a written pack: no rates, laws or names. */
function formatDerivedLines({ country, locale }: { country: string; locale: SupportedLocale }) {
  const place = getCountryName(country);
  const formattingLocale = getFormattingLocaleFor({ country, locale });
  const money = formatMoneyLine({ country, formattingLocale });

  return [
    `- Place: ${place}`,
    ...(money ? [`- Money: ${money}`] : []),
    `- Numbers, dates and units: ${formatNumbersLine(formattingLocale)}; the units people use in ${place}`,
    `- Facts: only ${place}'s own names, towns, institutions, taxes, schools and exams; when unsure whether something exists or holds in ${place}, stay general instead of guessing, and never borrow another country's`,
  ];
}

/**
 * The country content is set in, as a default the prompts let a title or exam that names another
 * place override (the SAT is American in any language). The register is how a text addresses its
 * reader, so a scene where people talk to each other leaves it out: a stranger at work there may
 * use the polite form a reader never gets.
 */
export function formatLocalContext({
  country,
  language,
  register = true,
}: ContentPlace & { register?: boolean }): string {
  const locale = getContentLocale(language);
  const settingCountry = resolveContentCountry({ country, language });

  if (!locale || !settingCountry) {
    return "LOCAL_CONTEXT: none";
  }

  const pack = COUNTRY_PACKS[settingCountry];

  const lines = pack
    ? formatPackLines({ country: settingCountry, locale, pack })
    : formatDerivedLines({ country: settingCountry, locale });

  const registerLines = register ? [`- Register: ${REGISTERS[locale]}`] : [];

  return ["LOCAL_CONTEXT:", ...lines, ...registerLines, BRANDS_LINE].join("\n");
}

const MONEY_EXAMPLE = 2400;

/** How text in this language writes this country's money, with cents and without. */
export function formatMoneyForms(place: ContentPlace): string | null {
  const locale = getContentLocale(place.language);
  const country = resolveContentCountry(place);
  const currency = country ? getContentCurrency(country) : null;

  if (!locale || !country || !currency) {
    return null;
  }

  const formattingLocale = getFormattingLocaleFor({ country, locale });
  const withCents = new Intl.NumberFormat(formattingLocale, { currency, style: "currency" });

  const whole = new Intl.NumberFormat(formattingLocale, {
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: "currency",
  });

  const forms = new Set([withCents.format(MONEY_EXAMPLE), whole.format(MONEY_EXAMPLE)]);
  return [...forms].join(" or ");
}

export function formatMoneyContext(place: ContentPlace): string {
  return `MONEY: ${formatMoneyForms(place) ?? "none"}`;
}

/** A country's name as prompts read it, in English like the rest of their inputs. */
export function getCountryName(country: string): string {
  return new Intl.DisplayNames(["en"], { type: "region" }).of(country) ?? country;
}
