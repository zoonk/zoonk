import { accessErrorCodes } from "@/lib/access-error-codes";
import { createErrorResponse, httpStatus } from "@/lib/api-errors";
import { type BirthYearCheck } from "@zoonk/core/profile/check-birth-year";

export function birthYearRefusal(result: Exclude<BirthYearCheck, { status: "allowed" }>) {
  if (result.status === "belowMinimumAge") {
    return createErrorResponse({
      code: accessErrorCodes.belowMinimumAge,
      details: { minimumAge: result.minimumAge },
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
