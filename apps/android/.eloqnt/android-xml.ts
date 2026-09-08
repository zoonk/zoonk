import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_LOCALE } from "@zoonk/utils/locale";
import { ANDROID_ROOT, SOURCE_CATALOG } from "../scripts/i18n/catalogs.mts";
import { createTrackedAndroidXmlCodec } from "../scripts/i18n/tracked-android-xml.mts";

/** @internal */
export default function createCodec() {
  return createTrackedAndroidXmlCodec({
    readSource: () => readFileSync(resolve(ANDROID_ROOT, `${SOURCE_CATALOG}.xml`), "utf8"),
    sourceLocale: DEFAULT_LOCALE,
  });
}
