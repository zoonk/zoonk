import { ACCESS_ERROR_CODES } from "@zoonk/auth/access-contract";
import { createErrorResponse, httpStatus } from "./api-errors";

/** Stable codes for the profile, allowance, guest and guardian endpoints. */
export const accessErrorCodes = {
  ...ACCESS_ERROR_CODES,
  accountRequired: "ACCOUNT_REQUIRED",
  alreadyGuest: "ALREADY_A_GUEST",
  birthChangeNeedsSupport: "BIRTH_CHANGE_NEEDS_SUPPORT",
  emailNotVerified: "EMAIL_NOT_VERIFIED",
  glassesNotEarned: "GLASSES_NOT_EARNED",
  goalNotFound: "GOAL_NOT_FOUND",
  guardianEmailMismatch: "GUARDIAN_EMAIL_MISMATCH",
  guardianInviteExpired: "GUARDIAN_INVITE_EXPIRED",
  guardianInviteLimitReached: "GUARDIAN_INVITE_LIMIT_REACHED",
  guardianNotAvailable: "GUARDIAN_NOT_AVAILABLE",
  noGuardian: "NO_GUARDIAN",
  plusApprovalNotNeeded: "PLUS_APPROVAL_NOT_NEEDED",
} as const;

/** Answering a birth date under 13 deletes the account, as the privacy policy promises. */
export function underMinimumAgeError() {
  return createErrorResponse({
    code: accessErrorCodes.underMinimumAge,
    message: "Zoonk is for learners 13 and older. The account was deleted.",
    status: httpStatus.forbidden,
  });
}
