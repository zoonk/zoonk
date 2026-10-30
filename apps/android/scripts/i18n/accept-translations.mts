import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import createAndroidXmlCodec from "@eloqnt/format-android-xml";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { catalogFile, catalogNames } from "./catalogs.mts";
import {
  addFingerprints,
  fingerprint,
  readFingerprints,
  stripFingerprints,
} from "./fingerprints.mts";

function decodeXml(content: string) {
  return createAndroidXmlCodec().decode(content);
}

/**
 * Re-fingerprints the current text of these ids in these locales, certifying it against the current English.
 * Every other entry keeps its fingerprint, so lint still flags it when stale. Throws, writing nothing, when a
 * locale isn't a target or an id has no translation in one of them.
 */
export async function acceptTranslations({
  root,
  locales,
  ids,
}: {
  root: string;
  locales: readonly string[];
  ids: readonly string[];
}) {
  const invalid = locales.filter(
    (locale) => locale === DEFAULT_LOCALE || !SUPPORTED_LOCALES.some((code) => code === locale),
  );

  if (invalid.length > 0) {
    throw new Error(`Not a target locale: ${invalid.join(", ")}`);
  }

  async function update(catalog: string, locale: string) {
    const sourceXml = await readFile(
      resolve(root, catalogFile({ catalog, locale: DEFAULT_LOCALE })),
      "utf8",
    );

    const sources = new Map(decodeXml(sourceXml).map((message) => [message.id, message]));
    const file = resolve(root, catalogFile({ catalog, locale }));
    const content = await readFile(file, "utf8");
    const xml = stripFingerprints(content);

    const accepted = decodeXml(xml).flatMap((target): [string, string][] => {
      const source = sources.get(target.id);

      return source && ids.includes(target.id)
        ? [[target.id, fingerprint({ locale, source, target })]]
        : [];
    });

    const fingerprints = { ...readFingerprints(content), ...Object.fromEntries(accepted) };

    return {
      accepted: accepted.map(([id]) => `${locale}:${id}`),
      content: addFingerprints({ fingerprints, xml }),
      file,
    };
  }

  const updates = await Promise.all(
    catalogNames(root).flatMap((catalog) => locales.map((locale) => update(catalog, locale))),
  );

  const accepted = new Set(updates.flatMap((entry) => entry.accepted));

  const unmatched = locales
    .flatMap((locale) => ids.map((id) => `${locale}:${id}`))
    .filter((key) => !accepted.has(key));

  if (unmatched.length > 0) {
    throw new Error(`No translation to accept for: ${unmatched.join(", ")}`);
  }

  const changed = updates.filter((entry) => entry.accepted.length > 0);

  await Promise.all(changed.map((entry) => writeFile(entry.file, entry.content)));
}
