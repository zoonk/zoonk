import "server-only";
import { getMinimumAge, isBelowMinimumAge, isValidBirthYear } from "@zoonk/utils/age";
import { getRequestCountry } from "@zoonk/utils/locale-request";
import { headers } from "next/headers";
import { type BirthYearInput } from "./learning-profile-contract";

export type BirthYearCheck =
  | { status: "allowed" }
  | { minimumAge: number; status: "belowMinimumAge" }
  | { status: "invalidBirthYear" };

/**
 * Needs no account, so a visitor below the minimum age where the request comes from is stopped
 * before one is made. Saves nothing.
 */
export async function checkBirthYear({ birthYear }: BirthYearInput): Promise<BirthYearCheck> {
  const country = getRequestCountry(await headers());
  const now = new Date();

  if (!isValidBirthYear({ birthYear, now })) {
    return { status: "invalidBirthYear" };
  }

  if (isBelowMinimumAge({ birthYear, country, now })) {
    return { minimumAge: getMinimumAge(country), status: "belowMinimumAge" };
  }

  return { status: "allowed" };
}
