import { getAppLocale } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";
import { getFormattingLocale } from "@zoonk/utils/locale";

export default async function EarlierQuestionsRedirect() {
  const locale = await getAppLocale();
  redirect({ href: "/buddy", locale: getFormattingLocale(locale) });
}
