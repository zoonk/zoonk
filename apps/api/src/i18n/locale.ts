import "server-only";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { getLocale } from "next-intl/server";

export async function getAppLocale() {
  return getSupportedLocaleFromLanguage(await getLocale());
}
