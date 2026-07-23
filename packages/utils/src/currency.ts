const COUNTRY_CURRENCY: Record<string, string> = {
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

export function countryToCurrency(countryCode: string): string {
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? "usd";
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

export function formatPrice(amount: number, currency: string, locale = "en-US"): string {
  const normalizedCurrency = currency.toLowerCase();
  const value = ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency) ? amount : amount / 100;

  return new Intl.NumberFormat(locale, {
    currency: currency.toUpperCase(),
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(value);
}
