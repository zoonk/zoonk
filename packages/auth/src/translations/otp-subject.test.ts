import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getTranslation } from "./get-translations";

const files = await readdir(import.meta.dirname);

const locales = files
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(".json", ""));

describe("sign-in code email", () => {
  it.each(locales)(
    "puts the code in the %s subject, so each email reads apart in the inbox",
    async (locale) => {
      const { otpSubject } = await getTranslation(locale);

      expect(otpSubject).toContain("{code}");
    },
  );
});
