import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { describe, expect, it } from "vitest";
import { formatCast } from "./cast";

function namesOf(cast: string): string[] {
  return /people (?<names>[^;]+);/u.exec(cast)?.groups?.names?.split(", ") ?? [];
}

function placesOf(cast: string): string[] {
  return /places (?<places>.+)$/u.exec(cast)?.groups?.places?.split(", ") ?? [];
}

describe(formatCast, () => {
  it.each(SUPPORTED_LOCALES)("gives %s eight different people and places", (language) => {
    const cast = formatCast({ country: null, language, seed: "lesson-1" });

    expect(new Set(namesOf(cast)).size).toBe(8);
    expect(new Set(placesOf(cast)).size).toBe(8);
  });

  it.each(["PT", "ES", "GB", "MX"])("gives %s its own people and places", (country) => {
    const cast = formatCast({ country, language: "en", seed: "lesson-1" });

    expect(new Set(namesOf(cast)).size).toBe(8);
    expect(cast).not.toBe(formatCast({ country: null, language: "en", seed: "lesson-1" }));
  });

  it("casts Spanish content in Mexico's towns and Spain's content in Spain's", () => {
    const mexico = placesOf(formatCast({ country: null, language: "es", seed: "a" }));
    const spain = placesOf(formatCast({ country: "ES", language: "es", seed: "a" }));

    expect(mexico.filter((place) => spain.includes(place))).toStrictEqual([]);
    expect(spain).toContain(placesOf(formatCast({ country: "ES", language: "pt", seed: "a" }))[0]);
  });

  it("gives the same call the same cast and parallel calls different ones", () => {
    const first = formatCast({ country: null, language: "pt", seed: "Direito Civil:Posse" });

    expect(formatCast({ country: null, language: "pt-BR", seed: "Direito Civil:Posse" })).toBe(
      first,
    );

    const casts = ["a", "b", "c", "d", "e"].map(
      (seed) => namesOf(formatCast({ country: null, language: "pt", seed }))[0],
    );

    expect(new Set(casts).size).toBeGreaterThan(2);
  });

  it("leaves countries without lists to the writer", () => {
    expect(formatCast({ country: null, language: "ar", seed: "a" })).toBe("CAST: none");
    expect(formatCast({ country: "AR", language: "es", seed: "a" })).toBe("CAST: none");
  });
});
