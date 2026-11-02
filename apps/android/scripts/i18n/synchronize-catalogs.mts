import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import createAndroidXmlCodec from "@eloqnt/format-android-xml";
import { DEFAULT_LOCALE } from "@zoonk/utils/locale";
import { catalogFile, catalogNames } from "./catalogs.mts";
import { createTrackedAndroidXmlCodec } from "./tracked-android-xml.mts";

/** Eloqnt only writes files that received translations; source-only deletions need an offline prune. */
export async function synchronizeCatalogs({
  root,
  locales,
}: {
  root: string;
  locales: readonly string[];
}) {
  const targets = locales.filter((locale) => locale !== DEFAULT_LOCALE);

  async function prepareCatalog(catalog: string) {
    const sourceFile = resolve(root, catalogFile({ catalog, locale: DEFAULT_LOCALE }));
    const sourceXml = await readFile(sourceFile, "utf8");
    const sourceMessages = createAndroidXmlCodec().decode(sourceXml);
    const sources = new Map(sourceMessages.map((message) => [message.id, message]));

    async function prepare(locale: string) {
      const file = resolve(root, catalogFile({ catalog, locale }));
      const previous = await readFile(file, "utf8");

      const codec = createTrackedAndroidXmlCodec({
        readSources: () => [sourceXml],
        sourceLocale: DEFAULT_LOCALE,
      });

      const messages = codec.decode(previous, { locale, sourceLocale: DEFAULT_LOCALE });
      const current = new Map(messages.map((message) => [message.id, message]));
      const missing = sourceMessages.filter((source) => !current.get(source.id)?.message.trim());

      if (missing.length > 0) {
        throw new Error(
          `${catalog} ${locale}: missing or stale translations: ${missing.map((message) => message.id).join(", ")}`,
        );
      }

      const retained = messages.filter((message) => sources.has(message.id));
      const xml = codec.encode(retained, { locale, sourceMessagesById: sources });
      return { file, previous, xml };
    }

    return Promise.all(targets.map((locale) => prepare(locale)));
  }

  const prepared = await Promise.all(catalogNames(root).map((catalog) => prepareCatalog(catalog)));

  const changed = prepared.flat().filter((catalog) => catalog.previous !== catalog.xml);
  await Promise.all(changed.map((catalog) => writeFile(catalog.file, catalog.xml)));
}
