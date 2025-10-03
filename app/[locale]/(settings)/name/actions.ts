"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function nameFormAction(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") || "").trim();

  try {
    if (!name) {
      return { status: "error", name };
    }

    const res = await auth.api.updateUser({
      body: { name },
      headers: await headers(),
    });

    const status = res.status ? "success" : "error";

    return { status, name };
  } catch {
    return { status: "error", name };
  }
}
