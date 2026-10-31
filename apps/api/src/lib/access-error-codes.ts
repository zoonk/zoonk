import { ACCESS_ERROR_CODES } from "@zoonk/auth/access-contract";

export const accessErrorCodes = {
  ...ACCESS_ERROR_CODES,
  accountRequired: "ACCOUNT_REQUIRED",
  alreadyGuest: "ALREADY_A_GUEST",
  belowMinimumAge: "BELOW_MINIMUM_AGE",
  emailNotVerified: "EMAIL_NOT_VERIFIED",
  glassesNotEarned: "GLASSES_NOT_EARNED",
  goalNotFound: "GOAL_NOT_FOUND",
  invalidBirthYear: "INVALID_BIRTH_YEAR",
} as const;
