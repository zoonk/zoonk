import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { birthYearRefusal } from "@/lib/birth-year-refusal";
import { readBody } from "@/lib/request-input";
import { birthYearInputSchema } from "@zoonk/core/profile/contract";
import { saveBirthYear } from "@zoonk/core/profile/save-birth-year";
import { type NextRequest } from "next/server";
import { createLearningProfileResponse } from "../learning-profile/_utils/learning-profile-response";

async function putBirthYear(request: NextRequest) {
  const body = await readBody(request, birthYearInputSchema);
  const result = await saveBirthYear(body);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "saved") {
    return createLearningProfileResponse(result.profile);
  }

  return birthYearRefusal(result);
}

export const PUT = withApiErrorBoundary(putBirthYear);
