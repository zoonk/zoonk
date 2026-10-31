import "server-only";
import { getLocaleFormatter } from "@zoonk/learn/formatter";
import { getLocale, getTimeZone } from "next-intl/server";

export async function getFormatter(params?: { locale?: string }) {
  const locale = params?.locale ?? (await getLocale());
  const timeZone = await getTimeZone(params);
  return getLocaleFormatter({ locale, timeZone });
}
