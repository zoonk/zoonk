import { describe, expect, it } from "vitest";
import createXcstringsCodec from "../.eloqnt/xcstrings.ts";

const KEY = "%lld questions are blank and %lld are flagged.";

function plural(argNum: number, unit: string) {
  return {
    argNum,
    formatSpecifier: "lld",
    variations: {
      plural: {
        one: { stringUnit: { state: "translated", value: `%arg ${unit}` } },
        other: { stringUnit: { state: "translated", value: `%arg ${unit}s` } },
      },
    },
  };
}

const english = {
  stringUnit: { state: "translated", value: "%1$#@blank@ and %2$#@flagged@." },
  substitutions: { blank: plural(1, "blank question"), flagged: plural(2, "flagged question") },
};

const german = {
  stringUnit: { state: "translated", value: "%2$#@flagged@ und %1$#@blank@." },
  substitutions: { blank: plural(1, "leere Frage"), flagged: plural(2, "markierte Frage") },
};

describe("positioned String Catalog plurals", () => {
  it("decodes both plural forms and preserves argument positions when a target locale is rewritten", () => {
    const catalog = {
      sourceLanguage: "en",
      strings: { [KEY]: { localizations: { de: german, en: english } } },
      version: "1.0",
    };

    const codec = createXcstringsCodec();
    const decoded = codec.decodeAll(JSON.stringify(catalog));

    expect(decoded.de?.[0]?.message).toBe(
      "{flagged, plural, one {# markierte Frage} other {# markierte Frages}} und {blank, plural, one {# leere Frage} other {# leere Frages}}.",
    );

    expect(
      JSON.parse(codec.encodeAll({ de: decoded.de ?? [] }, { sourceLocale: "en" })),
    ).toStrictEqual(catalog);
  });

  it("uses source argument positions for a translation in a new locale", () => {
    const codec = createXcstringsCodec();

    codec.decodeAll(
      JSON.stringify({
        sourceLanguage: "en",
        strings: { [KEY]: { localizations: { en: english } } },
        version: "1.0",
      }),
    );

    const encoded: unknown = JSON.parse(
      codec.encodeAll(
        {
          de: [
            {
              description: [],
              id: KEY,
              message:
                "{flagged, plural, one {# markierte Frage} other {# markierte Fragen}} und {blank, plural, one {# leere Frage} other {# leere Fragen}}.",
              references: [],
            },
          ],
        },
        { sourceLocale: "en" },
      ),
    );

    expect(encoded).toMatchObject({
      strings: {
        [KEY]: {
          localizations: {
            de: {
              stringUnit: german.stringUnit,
              substitutions: { blank: { argNum: 1 }, flagged: { argNum: 2 } },
            },
          },
        },
      },
    });
  });
});
