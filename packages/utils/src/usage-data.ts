export const COUNTRY_COOKIE = "ZOONK_COUNTRY";
export const USAGE_DATA_COOKIE = "ZOONK_USAGE_DATA";

/** Thirteen months at most, as European regulators ask of a cookie choice. */
export const USAGE_DATA_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Where analytics cookies wait for a visitor's yes: the EU and EEA (ePrivacy Directive), the UK
 * (PECR), Switzerland and Turkey (KVKK's cookie guidance).
 */
export const USAGE_DATA_CONSENT_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "CH",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GB",
  "GR",
  "HR",
  "HU",
  "IE",
  "IS",
  "IT",
  "LI",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
  "TR",
];

const CONSENT_COUNTRIES = new Set(USAGE_DATA_CONSENT_COUNTRIES);

/** An unknown country asks first. */
function requiresUsageDataConsent(country: string | null): boolean {
  return country === null || CONSENT_COUNTRIES.has(country.toUpperCase());
}

/**
 * A "no" from the account or from this browser wins, so turning usage data off on one device
 * stops it on the others; otherwise this browser's own choice comes before the account's.
 */
export function getUsageDataChoice({
  account,
  browser,
}: {
  account: boolean | null;
  browser: boolean | null;
}): boolean | null {
  return account === false || browser === false ? false : (browser ?? account);
}

/** null: nobody has chosen yet where the law needs a yes, so the visitor must be asked. */
export function resolveUsageDataSharing({
  choice,
  country,
}: {
  choice: boolean | null;
  country: string | null;
}): boolean | null {
  return choice ?? (requiresUsageDataConsent(country) ? null : true);
}

export function parseUsageDataCookie(value: string | null | undefined): boolean | null {
  if (value === "on") {
    return true;
  }

  return value === "off" ? false : null;
}

export function formatUsageDataCookie(share: boolean): string {
  return share ? "on" : "off";
}
