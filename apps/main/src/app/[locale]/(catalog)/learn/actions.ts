"use server";

import { parseFormField } from "@zoonk/utils/form";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export async function learnFormAction(formData: FormData) {
  const query = parseFormField(formData, "query");

  if (!query) {
    return;
  }

  const locale = await getLocale();
  const encodedQuery = encodeURIComponent(query);

  redirect({ href: `/learn/${encodedQuery}`, locale });
}
