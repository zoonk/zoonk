import { withApiErrorBoundary } from "@/lib/api-handler";
import { birthYearRefusal } from "@/lib/birth-year-refusal";
import { readBody } from "@/lib/request-input";
import { checkBirthYear } from "@zoonk/core/profile/check-birth-year";
import { birthYearInputSchema } from "@zoonk/core/profile/contract";
import { type NextRequest, NextResponse } from "next/server";

async function postAgeCheck(request: NextRequest) {
  const body = await readBody(request, birthYearInputSchema);
  const result = await checkBirthYear(body);

  return result.status === "allowed"
    ? new NextResponse(null, { status: 204 })
    : birthYearRefusal(result);
}

export const POST = withApiErrorBoundary(postAgeCheck);
