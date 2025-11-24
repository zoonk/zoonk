"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export async function learnFormAction(formData: FormData) {
  const query = formData.get("query")?.toString().trim();

  if (!query) {
    return;
  }

  const locale = await getLocale();
  const encodedQuery = encodeURIComponent(query);

  redirect({ href: `/learn/${encodedQuery}`, locale });
}
