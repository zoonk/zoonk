"use server";

import { parseFormField } from "@zoonk/utils/form";
import { redirect } from "next/navigation";

export async function learnFormAction(formData: FormData) {
  const query = parseFormField(formData, "query");

  if (!query) {
    return;
  }

  const encodedQuery = encodeURIComponent(query);

  redirect(`/learn/${encodedQuery}`);
}
