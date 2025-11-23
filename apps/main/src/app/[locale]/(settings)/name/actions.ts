"use server";

import { auth } from "@zoonk/auth";
import { headers } from "next/headers";

export async function nameFormAction(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") || "").trim();

  if (!name) {
    return { name, status: "error" };
  }

  const res = await auth.api.updateUser({
    body: { name },
    headers: await headers(),
  });

  if (res.status) {
    return { name, status: "success" };
  }

  console.error("Error updating name:", name);

  return { name, status: "error" };
}
