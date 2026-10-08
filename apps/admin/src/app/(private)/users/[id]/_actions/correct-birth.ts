"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { correctBirthForSupport } from "@zoonk/core/profile/correct-birth";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Corrects a learner's birth month and year after support has checked the request. Learners can
 * only make themselves younger, so this is the way to make them older. Core checks the admin role
 * again and deletes the account when the corrected age is under 13.
 */
export async function correctBirthAction(formData: FormData) {
  await assertAdmin();

  const userId = parseFormField(formData, "userId") ?? "";
  const month = Number(parseFormField(formData, "month"));
  const year = Number(parseFormField(formData, "year"));

  const result = await correctBirthForSupport({ birth: { month, year }, userId });

  if (result.status === "accountDeleted") {
    redirect("/users");
  }

  if (result.status !== "corrected") {
    throw new Error("Could not correct the birth date");
  }

  revalidatePath(`/users/${userId}`);
}
