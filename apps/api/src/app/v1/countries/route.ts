import { withApiErrorBoundary } from "@/lib/api-handler";
import { readQueryParams } from "@/lib/request-input";
import { countryLanguageQuerySchema, getCountryCatalog } from "@zoonk/core/goals/countries";
import { NextResponse } from "next/server";

async function listCountries(request: Request) {
  const { language } = readQueryParams(request, countryLanguageQuerySchema);

  return NextResponse.json(getCountryCatalog(language), {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
  });
}

export const GET = withApiErrorBoundary(listCountries);
