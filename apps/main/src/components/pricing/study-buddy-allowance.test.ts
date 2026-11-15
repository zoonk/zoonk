import compile from "icu-minify/compile";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { getStudyBuddyAllowance } from "./study-buddy-allowance";

// The server entry point needs a Next.js request; this formats each English source as the catalog would.
vi.mock("next-intl/server", () => ({
  getExtracted: async () => (message: string, values?: Record<string, number | string>) =>
    createTranslator({ locale: "en", messages: { message: compile(message) } })("message", values),
}));

describe(getStudyBuddyAllowance, () => {
  it("says the daily and the monthly cap", async () => {
    await expect(getStudyBuddyAllowance({ per30Days: 100, perDay: 10 })).resolves.toBe(
      "An AI study buddy: 10 messages a day, up to 100 a month",
    );
  });

  it("ends after the day when there's no monthly cap", async () => {
    await expect(getStudyBuddyAllowance({ per30Days: null, perDay: 1 })).resolves.toBe(
      "An AI study buddy: 1 message a day",
    );
  });

  it("says only the month when there's no daily cap", async () => {
    await expect(getStudyBuddyAllowance({ per30Days: 100, perDay: null })).resolves.toBe(
      "An AI study buddy: up to 100 messages a month",
    );
  });

  it("names the study buddy alone when there's no cap", async () => {
    await expect(getStudyBuddyAllowance({ per30Days: null, perDay: null })).resolves.toBe(
      "An AI study buddy",
    );
  });
});
