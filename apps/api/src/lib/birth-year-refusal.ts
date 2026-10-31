import { accessErrorCodes } from "@/lib/access-error-codes";
import { createErrorResponse, httpStatus } from "@/lib/api-errors";
import { type SaveBirthYearResult } from "@zoonk/core/profile/save-birth-year";

type BirthYearRefusal = Exclude<SaveBirthYearResult, { status: "saved" | "unauthorized" }>;

export function birthYearRefusal(result: BirthYearRefusal) {
  if (result.status === "belowMinimumAge" || result.status === "accountClosed") {
    return createErrorResponse({
      code: accessErrorCodes.belowMinimumAge,
      details: { accountClosed: result.status === "accountClosed", minimumAge: result.minimumAge },
      message: `Zoonk is for people ${result.minimumAge} and older here`,
      status: httpStatus.unprocessableEntity,
    });
  }

  return createErrorResponse({
    code: accessErrorCodes.invalidBirthYear,
    message: "The birth year is in the future or older than anyone alive",
    status: httpStatus.unprocessableEntity,
  });
}
