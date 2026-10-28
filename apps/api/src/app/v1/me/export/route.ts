import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { exportCurrentUserData } from "@zoonk/core/users/export";
import { NextResponse } from "next/server";

const ISO_DATE_LENGTH = 10;

async function exportAccountData() {
  const exported = await exportCurrentUserData();

  if (!exported) {
    return errors.unauthorized();
  }

  const date = exported.exportedAt.toISOString().slice(0, ISO_DATE_LENGTH);

  return NextResponse.json(withApiImageUrls(exported), {
    headers: { "Content-Disposition": `attachment; filename="zoonk-data-${date}.json"` },
  });
}

export const GET = withApiErrorBoundary(exportAccountData);
