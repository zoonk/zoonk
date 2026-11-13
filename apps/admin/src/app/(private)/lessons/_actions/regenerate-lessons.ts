"use server";

import { postAdminApi } from "@/lib/admin-api";
import { assertAdmin } from "@/lib/admin-guard";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

export async function regenerateLessonsAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const session = await assertAdmin();
  const model = parseFormField(formData, "model") || undefined;
  const promptVersion = parseFormField(formData, "promptVersion") || undefined;

  if (!(model || promptVersion)) {
    return { error: "Pick a model or a prompt version first." };
  }

  const response = await postAdminApi({
    body: { model, promptVersion },
    path: "/v1/library/lessons/regenerations",
    sessionToken: session.session.token,
  });

  if (!response.ok) {
    return { error: "Could not start the rewrite. Please try again." };
  }

  revalidatePath("/lessons");

  return { error: null };
}
