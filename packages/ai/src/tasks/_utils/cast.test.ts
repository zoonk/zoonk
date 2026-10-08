import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { describe, expect, it } from "vitest";
import { formatCast } from "./cast";

function namesOf(cast: string): string[] {
  return /people (?<names>[^;]+);/u.exec(cast)?.groups?.names?.split(", ") ?? [];
}

describe(formatCast, () => {
  it.each(SUPPORTED_LOCALES)("gives %s eight different people and places", (locale) => {
    const cast = formatCast({ language: locale, seed: "lesson-1" });
    const places = /places (?<places>.+)$/u.exec(cast)?.groups?.places?.split(", ") ?? [];

    expect(new Set(namesOf(cast)).size).toBe(8);
    expect(new Set(places).size).toBe(8);
  });

  it("gives the same call the same cast and parallel calls different ones", () => {
    const first = formatCast({ language: "pt", seed: "Direito Civil:Posse" });

    expect(formatCast({ language: "pt-BR", seed: "Direito Civil:Posse" })).toBe(first);

    const casts = ["a", "b", "c", "d", "e"].map(
      (seed) => namesOf(formatCast({ language: "pt", seed }))[0],
    );

    expect(new Set(casts).size).toBeGreaterThan(2);
  });

  it("leaves languages without lists to the writer", () => {
    expect(formatCast({ language: "ja", seed: "a" })).toBe("CAST: none");
  });
});
