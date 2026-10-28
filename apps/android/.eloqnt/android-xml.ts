import { DEFAULT_LOCALE } from "@zoonk/utils/locale";
import { ANDROID_ROOT, readSourceCatalogs } from "../scripts/i18n/catalogs.mts";
import { createTrackedAndroidXmlCodec } from "../scripts/i18n/tracked-android-xml.mts";

/** @internal */
export default function createCodec() {
  return createTrackedAndroidXmlCodec({
    readSources: () => readSourceCatalogs(ANDROID_ROOT),
    sourceLocale: DEFAULT_LOCALE,
  });
}
