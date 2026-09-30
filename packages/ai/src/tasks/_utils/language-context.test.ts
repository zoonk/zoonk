import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { describe, expect, it } from "vitest";
import { formatLocalContext } from "./language-context";

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
];

describe(formatLocalContext, () => {
  it.each(SUPPORTED_LOCALES)("gives %s a full context pack", (locale) => {
    const [heading, ...lines] = formatLocalContext(locale).split("\n");
    const labels = lines.map((line) => /^- (?<label>[^:]+): \S/u.exec(line)?.groups?.label);

    expect(heading).toBe("LOCAL_CONTEXT:");
    expect(labels).toStrictEqual(PACK_LINES);
  });

  it("describes the regional variant each language is written in", () => {
    expect(formatLocalContext("en")).toContain("- Place: the United States");
    expect(formatLocalContext("pt")).toContain("- Money: Brazilian real, written R$ 1.234,56");
    expect(formatLocalContext("es")).toContain("- Place: Spain");
  });

  it("reads regional language tags as their base language", () => {
    expect(formatLocalContext("pt-BR")).toBe(formatLocalContext("pt"));
  });

  it("has no pack for languages outside the app's languages", () => {
    expect(formatLocalContext("ja")).toBe("LOCAL_CONTEXT: none");
  });
});
