import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { listCurrentUserCertificateProgress } from "@zoonk/core/certificates/progress";
import { NextResponse } from "next/server";

async function listProgress() {
  const result = await listCurrentUserCertificateProgress();

  return result.status === "ready"
    ? NextResponse.json({ upNext: result.upNext })
    : errors.unauthorized();
}

export const GET = withApiErrorBoundary(listProgress);
