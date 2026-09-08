import { glob, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import createAndroidXmlCodec from "@eloqnt/format-android-xml";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";

export const ANDROID_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const SOURCE_CATALOG = "app/src/main/res/values/strings";
export const TARGET_CATALOG = "app/src/main/res/values-{code}/strings";

export function catalogFile(locale: string) {
  const catalog =
    locale === DEFAULT_LOCALE ? SOURCE_CATALOG : TARGET_CATALOG.replace("{code}", locale);

  return `${catalog}.xml`;
}

export async function untrackedCatalogs(root: string) {
  const files = await Array.fromAsync(glob("app/src/**/res/values*/*.xml", { cwd: root }));
  const tracked = new Set(SUPPORTED_LOCALES.map((locale) => catalogFile(locale)));
  const untracked = files.filter((file) => !tracked.has(file));

  async function containsMessages(file: string) {
    const xml = await readFile(resolve(root, file), "utf8");
    return createAndroidXmlCodec().decode(xml).length > 0 ? file : undefined;
  }

  const catalogs = await Promise.all(untracked.map((file) => containsMessages(file)));
  return catalogs.filter((file) => file !== undefined);
}
