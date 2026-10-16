import { describe, expect, it } from "vitest";
import { SESSION_EXPIRES_IN_DAYS } from "./config";
import { isSessionRenewalDue } from "./session-renewal";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 15, 12);

/** A session last renewed `days` ago ends this long after it. */
function endsAfterUse(days: number) {
  return NOW + (SESSION_EXPIRES_IN_DAYS - days) * DAY_MS;
}

describe(isSessionRenewalDue, () => {
  it("waits a day after the last renewal", () => {
    expect(isSessionRenewalDue({ expiresAt: endsAfterUse(0), now: NOW })).toBe(false);
    expect(isSessionRenewalDue({ expiresAt: endsAfterUse(0.99), now: NOW })).toBe(false);
  });

  it("is due from a day after the last renewal until the session ends", () => {
    expect(isSessionRenewalDue({ expiresAt: endsAfterUse(1), now: NOW })).toBe(true);
    expect(isSessionRenewalDue({ expiresAt: endsAfterUse(20), now: NOW })).toBe(true);
    expect(isSessionRenewalDue({ expiresAt: NOW + 1000, now: NOW })).toBe(true);
  });
});
