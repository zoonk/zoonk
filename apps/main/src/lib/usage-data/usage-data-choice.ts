import { sendFromBrowser } from "@/lib/api/browser-api";
import { readCookie, setCookie } from "@zoonk/utils/cookies";
import {
  COUNTRY_COOKIE,
  USAGE_DATA_COOKIE,
  USAGE_DATA_COOKIE_MAX_AGE,
  USAGE_DATA_MINOR_COOKIE,
  formatUsageDataCookie,
  parseUsageDataCookie,
} from "@zoonk/utils/usage-data";

const COUNTRY_PATH = "/api/country";

const listeners = new Set<() => void>();

/** For a cookie the server set, so `AppAnalytics` acts on it at once. */
export function notifyUsageDataChoice(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToUsageData(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readUsageDataCookie(): string | null {
  return readCookie(USAGE_DATA_COOKIE);
}

type BrowserUsageData = { choice: string | null; country: string | null };

let browserUsageData: BrowserUsageData = { choice: null, country: null };

/** The same object until a cookie changes, as `useSyncExternalStore` needs. */
export function readBrowserUsageData(): BrowserUsageData {
  const choice = readUsageDataCookie();
  const country = readCookie(COUNTRY_COOKIE);

  if (browserUsageData.choice !== choice || browserUsageData.country !== country) {
    browserUsageData = { choice, country };
  }

  return browserUsageData;
}

let readingCountry = false;

/** Static pages can't set a cookie (the CDN wouldn't keep them), so the browser asks when it has none. */
export function readRequestCountry(): void {
  if (readingCountry) {
    return;
  }

  readingCountry = true;

  void fetch(COUNTRY_PATH, { cache: "no-store" })
    .then(notifyUsageDataChoice)
    .catch(() => null)
    .finally(() => {
      readingCountry = false;
    });
}

async function writeUsageDataCookie({
  maxAge = USAGE_DATA_COOKIE_MAX_AGE,
  value,
}: {
  maxAge?: number;
  value: string;
}): Promise<void> {
  await setCookie(USAGE_DATA_COOKIE, value, { maxAge });
  notifyUsageDataChoice();
}

export function rememberUsageDataChoice(share: boolean): Promise<void> {
  return writeUsageDataCookie({ value: formatUsageDataCookie(share) });
}

export function rememberMinorBrowser(): Promise<void> {
  return writeUsageDataCookie({ value: USAGE_DATA_MINOR_COOKIE });
}

export function forgetMinorBrowser(): Promise<void> {
  return writeUsageDataCookie({ maxAge: 0, value: "" });
}

async function saveAccountChoice(share: boolean): Promise<boolean> {
  const response = await sendFromBrowser({
    body: { shareUsageData: share },
    method: "PATCH",
    path: "/v1/me/learning-profile",
  });

  return Boolean(response?.ok);
}

let carried = false;

/**
 * A choice made as a visitor goes with the account once there is one, so the server's events
 * follow it. A yes waits for `withYes`, once the learner is known not to be a minor who can't give
 * one, so it never turns analytics on when they're an adult. Resolves to whether the account has
 * it; nothing to carry counts as done.
 */
export async function carryUsageDataChoiceToAccount({
  withYes,
}: {
  withYes: boolean;
}): Promise<boolean> {
  const share = parseUsageDataCookie(readUsageDataCookie());

  if (carried || share === null || (share && !withYes)) {
    return true;
  }

  carried = await saveAccountChoice(share);
  return carried;
}

/**
 * This browser keeps it at once; an account keeps it too, so its other devices and the events the
 * server sends follow it. Resolves to whether the account saved it.
 */
export async function chooseUsageDataSharing({
  saveToAccount,
  share,
}: {
  saveToAccount: boolean;
  share: boolean;
}): Promise<boolean> {
  await rememberUsageDataChoice(share);

  if (!saveToAccount) {
    return true;
  }

  return saveAccountChoice(share);
}
