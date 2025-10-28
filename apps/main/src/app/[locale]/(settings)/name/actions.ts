"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function nameFormAction(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") || "").trim();

  try {
    if (!name) {
      return { name, status: "error" };
    }

    const res = await auth.api.updateUser({
      body: { name },
      headers: await headers(),
    });

    const status = res.status ? "success" : "error";

    return { name, status };
  } catch {
    return { name, status: "error" };
  }
}
