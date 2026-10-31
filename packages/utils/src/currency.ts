const COUNTRY_CURRENCY: Readonly<Record<string, string>> = {
  AD: "eur",
  AT: "eur",
  AU: "aud",
  BE: "eur",
  BG: "eur",
  BR: "brl",
  CA: "cad",
  CH: "chf",
  CL: "clp",
  CY: "eur",
  DE: "eur",
  DK: "dkk",
  EE: "eur",
  ES: "eur",
  FI: "eur",
  FR: "eur",
  GB: "gbp",
  GR: "eur",
  HK: "hkd",
  HR: "eur",
  HU: "huf",
  IE: "eur",
  IL: "ils",
  IN: "inr",
  IS: "isk",
  IT: "eur",
  JP: "jpy",
  KR: "krw",
  LT: "eur",
  LU: "eur",
  LV: "eur",
  MC: "eur",
  ME: "eur",
  MT: "eur",
  MX: "mxn",
  NL: "eur",
  NO: "nok",
  NZ: "nzd",
  PL: "pln",
  PT: "eur",
  SE: "sek",
  SG: "sgd",
  SI: "eur",
  SK: "eur",
  SM: "eur",
  TR: "try",
  US: "usd",
  UY: "uyu",
  VA: "eur",
  XK: "eur",
};

export type PriceInfo = { amount: number; currency: string };

export const DEFAULT_CURRENCY = "usd";

export const BILLING_CURRENCIES: readonly string[] = [
  ...new Set([DEFAULT_CURRENCY, ...Object.values(COUNTRY_CURRENCY)]),
];

export function countryToCurrency(countryCode: string): string {
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? DEFAULT_CURRENCY;
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

/** Stripe counts most currencies in cents; a zero-decimal currency, such as yen, in whole units. */
export function toMajorUnits(amount: number, currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? amount : amount / 100;
}

export function formatPrice(amount: number, currency: string, locale = "en-US"): string {
  const value = toMajorUnits(amount, currency);
  const fractionDigits = Number.isInteger(value) ? 0 : 2;

  return new Intl.NumberFormat(locale, {
    currency: currency.toUpperCase(),
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
    style: "currency",
  }).format(value);
}
