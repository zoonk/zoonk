const COUNTRY_CURRENCY: Record<string, string> = {
  AD: "eur",
  AE: "aed",
  AR: "ars",
  AT: "eur",
  AU: "aud",
  BE: "eur",
  BG: "bgn",
  BR: "brl",
  CA: "cad",
  CH: "chf",
  CL: "clp",
  CN: "cny",
  CO: "cop",
  CY: "eur",
  CZ: "czk",
  DE: "eur",
  DK: "dkk",
  EE: "eur",
  EG: "egp",
  ES: "eur",
  FI: "eur",
  FR: "eur",
  GB: "gbp",
  GR: "eur",
  HK: "hkd",
  HR: "eur",
  HU: "huf",
  ID: "idr",
  IE: "eur",
  IL: "ils",
  IN: "inr",
  IT: "eur",
  JP: "jpy",
  KR: "krw",
  LT: "eur",
  LU: "eur",
  LV: "eur",
  MC: "eur",
  MT: "eur",
  MX: "mxn",
  MY: "myr",
  NG: "ngn",
  NL: "eur",
  NO: "nok",
  NZ: "nzd",
  PE: "pen",
  PH: "php",
  PK: "pkr",
  PL: "pln",
  PT: "eur",
  RO: "ron",
  SA: "sar",
  SE: "sek",
  SG: "sgd",
  SI: "eur",
  SK: "eur",
  TH: "thb",
  TR: "try",
  TW: "twd",
  UA: "uah",
  US: "usd",
  VN: "vnd",
  ZA: "zar",
};

export type PriceInfo = {
  amount: number;
  currency: string;
};

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
