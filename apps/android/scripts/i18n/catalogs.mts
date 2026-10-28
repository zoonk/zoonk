import { globSync, readFileSync } from "node:fs";
import { glob, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import createAndroidXmlCodec from "@eloqnt/format-android-xml";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";

export const ANDROID_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Each `values/strings*.xml` is its own catalog (`strings`, `strings_today`), so feature copy can
 * live in its own file. Android merges them, which keeps resource names unique across catalogs.
 */
export function catalogNames(root: string) {
  return globSync("app/src/main/res/values/strings*.xml", { cwd: root })
    .map((file) => basename(file, ".xml"))
    .toSorted();
}

/** Eloqnt's `messages.path` entry for a catalog. */
export function catalogPath(catalog: string) {
  return {
    source: `app/src/main/res/values/${catalog}`,
    targets: `app/src/main/res/values-{code}/${catalog}`,
  };
}

export function catalogFile({ catalog, locale }: { catalog: string; locale: string }) {
  const { source, targets } = catalogPath(catalog);
  return `${locale === DEFAULT_LOCALE ? source : targets.replace("{code}", locale)}.xml`;
}

/** Every catalog's English XML, read by the codec to check each target's fingerprints. */
export function readSourceCatalogs(root: string) {
  return catalogNames(root).map((catalog) =>
    readFileSync(resolve(root, catalogFile({ catalog, locale: DEFAULT_LOCALE })), "utf8"),
  );
}

export async function untrackedCatalogs(root: string) {
  const files = await Array.fromAsync(glob("app/src/**/res/values*/*.xml", { cwd: root }));

  const tracked = new Set(
    catalogNames(root).flatMap((catalog) =>
      SUPPORTED_LOCALES.map((locale) => catalogFile({ catalog, locale })),
    ),
  );

  const untracked = files.filter((file) => !tracked.has(file));

  async function containsMessages(file: string) {
    const xml = await readFile(resolve(root, file), "utf8");
    return createAndroidXmlCodec().decode(xml).length > 0 ? file : undefined;
  }

  const catalogs = await Promise.all(untracked.map((file) => containsMessages(file)));
  return catalogs.filter((file) => file !== undefined);
}
