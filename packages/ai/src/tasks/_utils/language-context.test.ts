import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { describe, expect, it } from "vitest";
import { formatLocalContext, formatMoneyContext } from "./language-context";

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

describe(formatLocalContext, () => {
  it.each(SUPPORTED_LOCALES)("gives %s a full context pack", (locale) => {
    const [heading, ...lines] = formatLocalContext(locale).split("\n");
    const labels = lines.map((line) => /^- (?<label>[^:]+): \S/u.exec(line)?.groups?.label);

    expect(heading).toBe("LOCAL_CONTEXT:");
    expect(labels).toStrictEqual(PACK_LINES);
  });

  it("reads regional language tags as their base language", () => {
    expect(formatLocalContext("pt-BR")).toBe(formatLocalContext("pt"));
  });

  it("leaves out how a text addresses its reader for a scene where people talk", () => {
    const lines = formatLocalContext("es", { register: false }).split("\n").slice(1);
    const labels = lines.map((line) => /^- (?<label>[^:]+): \S/u.exec(line)?.groups?.label);

    expect(labels).toStrictEqual(PACK_LINES.filter((label) => label !== "Register"));
  });

  it("has no pack for languages outside the app's languages", () => {
    expect(formatLocalContext("ar")).toBe("LOCAL_CONTEXT: none");
  });
});

describe(formatMoneyContext, () => {
  it.each([
    ["pt", "MONEY: R$\u00A02.400,00 or R$\u00A02.400"],
    ["fr", "MONEY: 2\u202F400,00\u00A0€ or 2\u202F400\u00A0€"],
    ["ja", "MONEY: ￥2,400"],
  ])("writes %s's own currency with cents and without", (language, expected) => {
    expect(formatMoneyContext(language)).toBe(expected);
  });

  it("has no money format for languages outside the app's languages", () => {
    expect(formatMoneyContext("ar")).toBe("MONEY: none");
  });
});
