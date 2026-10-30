import { describe, expect, it } from "vitest";
import { type Catalog, type PackageName, findReuses } from "./find-reuses.ts";

function catalog(
  packageName: PackageName,
  messages: Partial<Catalog["messages"][number]>[],
): Catalog {
  return {
    locales: ["de", "pt"],
    messages: messages.map((message, index) => ({
      comment: "",
      english: "",
      id: `${packageName}-${index}`,
      translations: {},
      ...message,
    })),
    name: packageName,
    packageName,
  };
}

function translations(reuses: ReturnType<typeof findReuses>) {
  return reuses.map(({ catalog: { name }, locale, id, translation }) => ({
    id,
    locale,
    name,
    translation,
  }));
}

describe(findReuses, () => {
  it("fills a missing translation from another catalog and maps its placeholders", () => {
    const android = catalog("android", [
      { english: "{arg1} lessons left today", translations: { pt: "Faltam {arg1} lições hoje" } },
    ]);

    const main = catalog("main", [{ english: "{count} lessons left today" }]);

    expect(
      translations(findReuses({ catalogs: [main, android], packageName: "main" })),
    ).toStrictEqual([
      { id: "main-0", locale: "pt", name: "main", translation: "Faltam {count} lições hoje" },
    ]);
  });

  it("never replaces an existing translation and fills a blank one", () => {
    const learn = catalog("learn", [
      { english: "Start your first lesson", translations: { de: "Starte deine erste Lektion" } },
    ]);

    const main = catalog("main", [
      { english: "Start your first lesson", translations: { de: "Beginne", pt: "  " } },
    ]);

    expect(findReuses({ catalogs: [main, learn], packageName: "main" })).toStrictEqual([]);

    const blank = catalog("main", [
      { english: "Start your first lesson", translations: { de: "  " } },
    ]);

    expect(
      translations(findReuses({ catalogs: [blank, learn], packageName: "main" })),
    ).toStrictEqual([
      { id: "main-0", locale: "de", name: "main", translation: "Starte deine erste Lektion" },
    ]);
  });

  it("leaves a translation someone asked Eloqnt to redo to Eloqnt", () => {
    const main = catalog("main", [
      { english: "Start your first lesson", translations: { de: "Starte", pt: "Começar" } },
    ]);

    const apple = catalog("apple", [{ english: "Start your first lesson", retranslate: ["pt"] }]);

    expect(
      translations(findReuses({ catalogs: [main, apple], packageName: "apple" })),
    ).toStrictEqual([{ id: "apple-0", locale: "de", name: "apple", translation: "Starte" }]);
  });

  it("matches labels under three words only with the same translator comment", () => {
    const apple = catalog("apple", [
      { comment: "Status of a paused plan", english: "Paused", translations: { pt: "Pausado" } },
      { english: "Paused", translations: { pt: "Pausada" } },
    ]);

    const android = catalog("android", [
      { comment: "Status of a paused plan", english: "Paused" },
      { comment: "Status of a paused course", english: "Paused" },
      { english: "Paused" },
    ]);

    expect(
      translations(findReuses({ catalogs: [apple, android], packageName: "android" })),
    ).toStrictEqual([
      { id: "android-0", locale: "pt", name: "android", translation: "Pausado" },
      { id: "android-2", locale: "pt", name: "android", translation: "Pausada" },
    ]);
  });

  it("leaves plurals and selects to Eloqnt", () => {
    const main = catalog("main", [
      {
        english: "{count, plural, one {# day left} other {# days left}}",
        translations: { pt: "{count, plural, one {# dia} other {# dias}}" },
      },
      { english: "You finished it today", translations: { pt: "{x, select, a {A} other {B}}" } },
    ]);

    const learn = catalog("learn", [
      { english: "{count, plural, one {# day left} other {# days left}}" },
      { english: "You finished it today" },
    ]);

    expect(findReuses({ catalogs: [main, learn], packageName: "learn" })).toStrictEqual([]);
  });

  it("picks its own package first, then main, learn, player, api, Apple, and Android", () => {
    const english = "Keep going with your plan";

    const catalogs = [
      catalog("android", [{ english, translations: { de: "android", pt: "android" } }]),
      catalog("apple", [{ english, translations: { de: "apple", pt: "apple" } }]),
      catalog("learn", [{ english, translations: { pt: "learn" } }]),
      catalog("player", [{ english }, { english, translations: { pt: "player" } }]),
    ];

    expect(translations(findReuses({ catalogs, packageName: "player" }))).toStrictEqual([
      { id: "player-0", locale: "de", name: "player", translation: "apple" },
      { id: "player-0", locale: "pt", name: "player", translation: "player" },
      { id: "player-1", locale: "de", name: "player", translation: "apple" },
    ]);
  });

  it("skips a source whose placeholders can't be mapped and fills only its own package", () => {
    const english = "{name} joined your study group";

    const catalogs = [
      catalog("main", [{ english, translations: { pt: "{nome} entrou no seu grupo" } }]),
      catalog("learn", [{ english, translations: { pt: "{name} entrou no grupo de estudo" } }]),
      catalog("api", [{ english }]),
      catalog("player", [{ english }]),
    ];

    expect(translations(findReuses({ catalogs, packageName: "api" }))).toStrictEqual([
      { id: "api-0", locale: "pt", name: "api", translation: "{name} entrou no grupo de estudo" },
    ]);
  });

  it("matches native placeholders only of the same printf type, and web ones with either", () => {
    const apple = catalog("apple", [
      {
        english: "Your score is {arg1}",
        kinds: { arg1: "s" },
        translations: { pt: "Nota {arg1}" },
      },
    ]);

    const learn = catalog("learn", [
      { english: "Your score is {score}", translations: { de: "Dein Ergebnis: {score}" } },
    ]);

    const android = catalog("android", [{ english: "Your score is {arg1}", kinds: { arg1: "d" } }]);

    expect(
      translations(findReuses({ catalogs: [apple, learn, android], packageName: "android" })),
    ).toStrictEqual([
      { id: "android-0", locale: "de", name: "android", translation: "Dein Ergebnis: {arg1}" },
    ]);
  });
});
