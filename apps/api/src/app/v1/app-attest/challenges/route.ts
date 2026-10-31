import { withApiErrorBoundary } from "@/lib/api-handler";
import { authRateLimitError } from "@/lib/auth-rate-limit-error";
import { createAppAttestChallenge } from "@zoonk/auth/app-attest";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";

async function createChallenge(request: NextRequest) {
  const { data, error } = await safeAsync(() =>
    createAppAttestChallenge({ headers: request.headers, requestURL: request.url }),
  );

  if (error) {
    const response = authRateLimitError(error);

    if (response) {
      return response;
    }

    throw error;
  }

  return NextResponse.json(data, { status: 201 });
}

export const POST = withApiErrorBoundary(createChallenge);
