"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { eraseMemoryFactForSupport } from "@zoonk/core/memory/erase-fact";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

export async function eraseMemoryFactAction(formData: FormData) {
  await assertAdmin();

  const factId = parseFormField(formData, "factId") ?? "";
  const userId = parseFormField(formData, "userId") ?? "";

  const result = await eraseMemoryFactForSupport(factId);

  if (result.status !== "erased") {
    throw new Error("Could not erase this fact");
  }

  revalidatePath(`/users/${userId}`);
}
