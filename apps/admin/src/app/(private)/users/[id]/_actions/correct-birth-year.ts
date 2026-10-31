"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { correctBirthYearForSupport } from "@zoonk/core/profile/correct-birth-year";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function correctBirthYearAction(formData: FormData) {
  await assertAdmin();

  const userId = parseFormField(formData, "userId") ?? "";
  const birthYear = Number(parseFormField(formData, "birthYear"));
  const { status } = await correctBirthYearForSupport({ birthYear, userId });

  if (status === "accountClosed") {
    redirect("/users");
  }

  if (status !== "saved") {
    throw new Error("Could not correct the birth year");
  }

  revalidatePath(`/users/${userId}`);
}
