import createAppleCodec from "@eloqnt/format-apple-xcstrings";

type Localization = { stringUnit?: { value: string }; substitutions?: Record<string, unknown> };

type Catalog = {
  sourceLanguage: string;
  strings: Record<string, { localizations?: Record<string, Localization> }>;
};

const POSITIONAL_SUBSTITUTION = /%%|%\d+\$#@(?<name>[^@]+)@/gu;
const SUBSTITUTION = /%%|%#@(?<name>[^@]+)@/gu;

function readCatalog(content: string): Catalog {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The upstream codec validates the catalog.
  return JSON.parse(content) as Catalog;
}

function catalogText(catalog: Catalog): string {
  return JSON.stringify(catalog, null, 2)
    .replaceAll(/^(?<key>\s*"(?:[^"\\]|\\.)*"): /gmu, "$<key> : ")
    .replaceAll(
      /^(?<indent> *)(?<key>"(?:[^"\\]|\\.)*" : )\{\}(?<comma>,?)$/gmu,
      "$<indent>$<key>{\n\n$<indent>}$<comma>",
    );
}

function normalizePositions(catalog: Catalog) {
  const positions = new Map<string, Map<string, Map<string, string>>>();

  for (const [id, entry] of Object.entries(catalog.strings)) {
    const byLocale = new Map<string, Map<string, string>>();

    for (const [locale, { stringUnit, substitutions }] of Object.entries(
      entry.localizations ?? {},
    )) {
      if (stringUnit && substitutions) {
        const byName = new Map<string, string>();

        stringUnit.value = stringUnit.value.replaceAll(
          POSITIONAL_SUBSTITUTION,
          (token: string, name?: string) => {
            if (!name || !Object.hasOwn(substitutions, name)) {
              return token;
            }

            byName.set(name, token);
            return `%#@${name}@`;
          },
        );

        byLocale.set(locale, byName);
      }
    }

    if ([...byLocale.values()].some((byName) => byName.size > 0)) {
      positions.set(id, byLocale);
    }
  }

  return positions;
}

// Eloqnt 0.0.10 decodes only bare substitution tokens. Give it those tokens for ICU conversion,
// then restore the original positions by substitution name even if a translation moves the clause.
/** @internal */
export default function createXcstringsCodec(): ReturnType<typeof createAppleCodec> {
  const codec = createAppleCodec();
  let positions: ReturnType<typeof normalizePositions>;

  return {
    decodeAll(content) {
      const catalog = readCatalog(content);
      positions = normalizePositions(catalog);
      return codec.decodeAll(positions.size > 0 ? JSON.stringify(catalog) : content);
    },
    encodeAll(messages, context) {
      const content = codec.encodeAll(messages, context);

      if (!positions?.size) {
        return content;
      }

      const catalog = readCatalog(content);

      for (const [id, byLocale] of positions) {
        for (const [locale, { stringUnit, substitutions }] of Object.entries(
          catalog.strings[id]?.localizations ?? {},
        )) {
          const byName = byLocale.get(locale) ?? byLocale.get(catalog.sourceLanguage);

          if (stringUnit && substitutions && byName?.size) {
            stringUnit.value = stringUnit.value.replaceAll(
              SUBSTITUTION,
              (token: string, name?: string) => (name ? (byName.get(name) ?? token) : token),
            );
          }
        }
      }

      return catalogText(catalog);
    },
    file: codec.file,
  };
}
