"use server";

import { type BirthYearCheck, checkBirthYear } from "@zoonk/core/profile/check-birth-year";

export async function checkBirthYearAction(birthYear: unknown): Promise<BirthYearCheck> {
  return Number.isInteger(birthYear)
    ? checkBirthYear({ birthYear: Number(birthYear) })
    : { status: "invalidBirthYear" };
}
