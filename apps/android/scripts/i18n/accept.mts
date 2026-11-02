import { parseArgs } from "node:util";
import { acceptTranslations } from "./accept-translations.mts";
import { ANDROID_ROOT } from "./catalogs.mts";

const { values } = parseArgs({ options: { id: { type: "string" }, locale: { type: "string" } } });

if (!values.id || !values.locale) {
  throw new Error(
    "Usage: pnpm --filter android i18n:accept --locale <locales> --id <ids> (comma-separated)",
  );
}

await acceptTranslations({
  ids: values.id.split(","),
  locales: values.locale.split(","),
  root: ANDROID_ROOT,
});
