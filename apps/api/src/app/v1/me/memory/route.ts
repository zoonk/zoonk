import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { memorySettingsUpdateSchema } from "@zoonk/core/memory/contract";
import { getCurrentUserMemory } from "@zoonk/core/memory/get";
import { updateMemorySettings } from "@zoonk/core/memory/settings";
import { type NextRequest, NextResponse } from "next/server";

async function getMemory() {
  const memory = await getCurrentUserMemory();

  if (!memory) {
    return errors.unauthorized();
  }

  return NextResponse.json(memory);
}

async function updateSettings(request: NextRequest) {
  const parsed = await readBody(request, memorySettingsUpdateSchema);

  const result = await updateMemorySettings(parsed);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return NextResponse.json({ enabled: result.enabled });
}

export const GET = withApiErrorBoundary(getMemory);
export const PATCH = withApiErrorBoundary(updateSettings);
