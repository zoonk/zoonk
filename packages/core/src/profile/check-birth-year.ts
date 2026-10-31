import "server-only";
import {
  getMinimumAge,
  isBelowMinimumAge,
  isCertainlyBelowMinimumAge,
  isValidBirthYear,
} from "@zoonk/utils/age";
import { getRequestCountry } from "@zoonk/utils/locale-request";
import { headers } from "next/headers";
import { type BirthYearInput } from "./learning-profile-contract";

/** `certain`: younger than the minimum even if this year's birthday has passed. */
export type BirthYearCheck =
  | { status: "allowed" }
  | { certain: boolean; minimumAge: number; status: "belowMinimumAge" }
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
    return {
      certain: isCertainlyBelowMinimumAge({ birthYear, country, now }),
      minimumAge: getMinimumAge(country),
      status: "belowMinimumAge",
    };
  }

  return { status: "allowed" };
}
