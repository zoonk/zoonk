import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { exportCurrentUserMemory } from "@zoonk/core/memory/export";
import { NextResponse } from "next/server";

/** Every fact and insight in the learner's memory, for an export with their account data. */
async function exportMemory() {
  const exported = await exportCurrentUserMemory();

  if (!exported) {
    return errors.unauthorized();
  }

  return NextResponse.json(exported);
}

export const GET = withApiErrorBoundary(exportMemory);
