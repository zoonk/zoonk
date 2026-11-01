import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The wording the law fixes for the cancel and withdrawal buttons: Directive (EU)
 * 2023/2673 (art. 11a of the Consumer Rights Directive) in each EU language, and BGB § 312k in
 * German. A re-translation must never change them.
 */
const LEGAL_LABELS: Record<string, Record<string, string>> = {
  de: { "Cancel now": "Jetzt kündigen", "Confirm withdrawal": "Widerruf bestätigen" },
  es: { "Confirm withdrawal": "Confirmar desistimiento" },
  fr: { "Confirm withdrawal": "Confirmer la rétractation" },
  it: { "Confirm withdrawal": "Conferma recesso" },
  pl: { "Confirm withdrawal": "Potwierdź odstąpienie od umowy" },
  pt: { "Confirm withdrawal": "Confirmar retratação" },
};

function catalogPath(locale: string): string {
  return resolve(import.meta.dirname, `../../../messages/${locale}.po`);
}

function readTranslation(catalog: string, message: string): string | null {
  const entry = new RegExp(`msgid "${message}"\\nmsgstr "(.*)"`, "u").exec(catalog);
  return entry?.[1] ?? null;
}

const shippedLocales = Object.keys(LEGAL_LABELS).filter((locale) =>
  existsSync(catalogPath(locale)),
);

describe("legally fixed labels", () => {
  it.each(shippedLocales)("keeps the official wording in %s", (locale) => {
    const catalog = readFileSync(catalogPath(locale), "utf8");
    const labels = LEGAL_LABELS[locale] ?? {};

    const translations = Object.fromEntries(
      Object.keys(labels).map((message) => [message, readTranslation(catalog, message)]),
    );

    expect(translations).toStrictEqual(labels);
  });
});
