import compile from "icu-minify/compile";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { getBestDayName } from "./pattern-summary";

// The server entry point needs a Next.js request; this formats each English source as the catalog would.
vi.mock("next-intl/server", () => ({
  getExtracted: async () => (message: string, values?: Record<string, number | string>) =>
    createTranslator({ locale: "en", messages: { message: compile(message) } })("message", values),
}));

vi.mock("@/i18n/locale", () => ({ getAppLocale: async () => "en" }));

describe(getBestDayName, () => {
  it("says no day stands out once there are enough answers", async () => {
    await expect(getBestDayName({ kind: "even", points: 3 })).resolves.toBe(
      "You answer about the same every day.",
    );
  });

  it("names nothing while there are too few answers", async () => {
    await expect(getBestDayName({ kind: "notEnough" })).resolves.toBeNull();
  });
});
