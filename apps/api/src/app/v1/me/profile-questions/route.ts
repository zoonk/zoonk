import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { getProfileQuestions } from "@zoonk/core/profile/questions/get";
import { getLocaleFromRequest } from "@zoonk/utils/locale-request";
import { NextResponse } from "next/server";

async function getQuestions(request: Request) {
  const profile = await getProfileQuestions({
    locale: getLocaleFromRequest({ acceptLanguage: request.headers.get("accept-language") }),
  });

  return profile ? NextResponse.json(profile) : errors.unauthorized();
}
export const GET = withApiErrorBoundary(getQuestions);
