import defineEloqntConfig from "@zoonk/i18n/define-eloqnt-config";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { ANDROID_ROOT, catalogNames, catalogPath } from "../scripts/i18n/catalogs.mts";

/** @internal */
export default defineEloqntConfig({
  messages: {
    format: { codec: "./.eloqnt/android-xml.ts", extension: ".xml" },
    locales: [...SUPPORTED_LOCALES],
    path: catalogNames(ANDROID_ROOT).map((catalog) => catalogPath(catalog)),
    sourceLocale: DEFAULT_LOCALE,
  },
  srcPath: null,
});
