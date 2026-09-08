import defineEloqntConfig from "@zoonk/i18n/define-eloqnt-config";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { SOURCE_CATALOG, TARGET_CATALOG } from "../scripts/i18n/catalogs.mts";

/** @internal */
export default defineEloqntConfig({
  messages: {
    format: { codec: "./.eloqnt/android-xml.ts", extension: ".xml" },
    locales: [...SUPPORTED_LOCALES],
    path: { source: SOURCE_CATALOG, targets: TARGET_CATALOG },
    sourceLocale: DEFAULT_LOCALE,
  },
  srcPath: null,
});
