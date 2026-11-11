import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { describe, expect, it } from "vitest";
import { formatLocalContext, formatMoneyContext, resolveContentCountry } from "./language-context";

const PACK_LINES = [
  "Place",
  "Money",
  "Numbers, dates and units",
  "Common first names",
  "Cities and places",
  "Everyday life",
  "School",
  "National exams",
  "Register",
  "Brands",
];

function labelsOf(context: string): (string | undefined)[] {
  return context
    .split("\n")
    .slice(1)
    .map((line) => /^- (?<label>[^:]+): \S/u.exec(line)?.groups?.label);
}

function lineOf(context: string, label: string): string | undefined {
  return context.split("\n").find((line) => line.startsWith(`- ${label}: `));
}

describe(resolveContentCountry, () => {
  it("sets content in the language's own country unless it names another", () => {
    expect(resolveContentCountry({ country: null, language: "pt" })).toBe("BR");
    expect(resolveContentCountry({ country: "PT", language: "pt" })).toBe("PT");
    expect(resolveContentCountry({ country: "ZZ", language: "es" })).toBe("MX");
  });
});

describe(formatLocalContext, () => {
  it("keeps every language's own country exactly as it was", async () => {
    const text = SUPPORTED_LOCALES.map((language) =>
      [
        `# ${language}`,
        formatLocalContext({ country: null, language }),
        formatLocalContext({ country: null, language, register: false }),
        formatMoneyContext({ country: null, language }),
      ].join("\n"),
    ).join("\n\n");

    await expect(`${text}\n`).toMatchFileSnapshot("own-country-context.txt");
  });

  it.each(SUPPORTED_LOCALES)("gives %s a full context pack", (language) => {
    const context = formatLocalContext({ country: null, language });

    expect(context.split("\n")[0]).toBe("LOCAL_CONTEXT:");
    expect(labelsOf(context)).toStrictEqual(PACK_LINES);
  });

  it.each(["PT", "ES", "GB", "MX", "US", "DE"])("has a written pack for %s", (country) => {
    expect(labelsOf(formatLocalContext({ country, language: "en" }))).toStrictEqual(PACK_LINES);
  });

  it("reads a regional language tag as its language, for the place and the money alike", () => {
    expect(formatLocalContext({ country: null, language: "pt-PT" })).toBe(
      formatLocalContext({ country: null, language: "pt" }),
    );

    expect(formatMoneyContext({ country: null, language: "pt-PT" })).toBe(
      formatMoneyContext({ country: null, language: "pt" }),
    );

    expect(formatMoneyContext({ country: null, language: "es-AR" })).toBe(
      formatMoneyContext({ country: null, language: "es" }),
    );
  });

  it("sets a Portuguese course about Portugal in Portugal, in euros", () => {
    const context = formatLocalContext({ country: "PT", language: "pt" });

    expect(lineOf(context, "Place")).toBe("- Place: Portugal");
    expect(lineOf(context, "Money")).toContain("euro");
    expect(lineOf(context, "Register")).toContain('"você"');

    expect(formatMoneyContext({ country: "PT", language: "pt" })).toBe(
      "MONEY: 2400,00 € or 2400 €",
    );
  });

  it("keeps the writing language's register and number format in another country's pack", () => {
    const context = formatLocalContext({ country: "DE", language: "pt" });

    expect(lineOf(context, "Place")).toBe("- Place: Germany");

    expect(lineOf(context, "Register")).toBe(
      formatLocalContext({ country: null, language: "pt" })
        .split("\n")
        .find((line) => line.startsWith("- Register: ")),
    );

    expect(context).not.toContain('"du"');
    expect(lineOf(context, "Money")).toBe("- Money: Euro (EUR), written € 1.234,56");
    expect(lineOf(context, "Numbers, dates and units")).toContain("1.234,56");
    expect(lineOf(context, "Cities and places")).toContain("Berlin");
  });

  it("leaves the register out for a scene where people talk", () => {
    const context = formatLocalContext({ country: "PT", language: "pt", register: false });

    expect(labelsOf(context)).toStrictEqual(PACK_LINES.filter((label) => label !== "Register"));
  });

  it("gives a country without a pack only what's known for sure, in its own currency", () => {
    const context = formatLocalContext({ country: "AR", language: "es" });

    expect(labelsOf(context)).toStrictEqual([
      "Place",
      "Money",
      "Numbers, dates and units",
      "Facts",
      "Register",
      "Brands",
    ]);

    expect(lineOf(context, "Place")).toBe("- Place: Argentina");
    expect(lineOf(context, "Money")).toBe("- Money: Argentine Peso (ARS), written $ 1.234,56");
    expect(lineOf(context, "Facts")).toContain("stay general");

    expect(formatMoneyContext({ country: "AR", language: "es" })).toBe(
      "MONEY: $ 2.400,00 or $ 2.400",
    );
  });

  it("writes another country's numbers the way the text's language does where it isn't spoken", () => {
    const context = formatLocalContext({ country: "JP", language: "pt" });

    expect(lineOf(context, "Money")).toBe("- Money: Japanese Yen (JPY), written JP¥ 1.235");
    expect(lineOf(context, "Numbers, dates and units")).toMatch(/^- [^:]+: 1\.234,56 /u);
  });

  it("has no setting for languages outside the app's languages", () => {
    expect(formatLocalContext({ country: null, language: "ar" })).toBe("LOCAL_CONTEXT: none");
    expect(formatMoneyContext({ country: null, language: "ar" })).toBe("MONEY: none");
  });

  it("has no money for a country without a currency of its own", () => {
    const context = formatLocalContext({ country: "AQ", language: "en" });

    expect(lineOf(context, "Money")).toBeUndefined();
    expect(formatMoneyContext({ country: "AQ", language: "en" })).toBe("MONEY: none");
  });
});
