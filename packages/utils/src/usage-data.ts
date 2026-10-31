export const COUNTRY_COOKIE = "ZOONK_COUNTRY";
export const USAGE_DATA_COOKIE = "ZOONK_USAGE_DATA";

/** Thirteen months at most, as European regulators ask of a cookie choice. */
export const USAGE_DATA_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Where analytics cookies wait for a visitor's yes: the EU and EEA (ePrivacy Directive), with
 * Åland, Svalbard and Jan Mayen, Bouvet Island, and every French overseas territory (France's cookie rule applies
 * there too), whose codes aren't their country's; the UK (PECR), with Gibraltar, Jersey, Guernsey
 * and the Isle of Man, which keep a cookie rule of their own; Switzerland; and Turkey (KVKK's cookie
 * guidance).
 */
export const USAGE_DATA_CONSENT_COUNTRIES = [
  "AT",
  "AX",
  "BE",
  "BG",
  "BL",
  "BV",
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
  "GF",
  "GG",
  "GI",
  "GP",
  "GR",
  "HR",
  "HU",
  "IE",
  "IM",
  "IS",
  "IT",
  "JE",
  "LI",
  "LT",
  "LU",
  "LV",
  "MF",
  "MQ",
  "MT",
  "NC",
  "NL",
  "NO",
  "PF",
  "PL",
  "PM",
  "PT",
  "RE",
  "RO",
  "SE",
  "SI",
  "SJ",
  "SK",
  "TF",
  "TR",
  "WF",
  "YT",
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

/** A learner known to be a minor can't give the yes the law needs, so it stays off whatever they chose. */
export function isUsageDataLockedOff({
  country,
  minor,
}: {
  country: string | null;
  minor: boolean;
}): boolean {
  return minor && requiresUsageDataConsent(country);
}

/** null: nobody has chosen yet where the law needs a yes, so the visitor must be asked. */
export function resolveUsageDataSharing({
  choice,
  country,
  minor,
}: {
  choice: boolean | null;
  country: string | null;
  minor: boolean;
}): boolean | null {
  if (isUsageDataLockedOff({ country, minor })) {
    return false;
  }

  return choice ?? (requiresUsageDataConsent(country) ? null : true);
}

export function parseUsageDataCookie(value: string | null | undefined): boolean | null {
  if (value === "on") {
    return true;
  }

  return value === "off" ? false : null;
}

/**
 * Hides the notice for a known minor where they can't say yes. It isn't a choice, so they're asked
 * once they're an adult.
 */
export const USAGE_DATA_MINOR_COOKIE = "minor";

export function formatUsageDataCookie(share: boolean): string {
  return share ? "on" : "off";
}
