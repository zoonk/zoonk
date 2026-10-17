import { ACCESS_ERROR_CODES } from "@zoonk/auth/access-contract";

/** Stable codes for the profile, allowance and guest endpoints. */
export const accessErrorCodes = {
  ...ACCESS_ERROR_CODES,
  accountRequired: "ACCOUNT_REQUIRED",
  alreadyGuest: "ALREADY_A_GUEST",
  emailNotVerified: "EMAIL_NOT_VERIFIED",
  glassesNotEarned: "GLASSES_NOT_EARNED",
  goalNotFound: "GOAL_NOT_FOUND",
} as const;
