import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { memorySettingsUpdateSchema } from "@zoonk/core/memory/contract";
import { getCurrentUserMemory } from "@zoonk/core/memory/get";
import { updateMemorySettings } from "@zoonk/core/memory/settings";
import { type NextRequest, NextResponse } from "next/server";

/** Everything Zoonk remembers about the learner, with the memory switch. */
async function getMemory() {
  const memory = await getCurrentUserMemory();

  if (!memory) {
    return errors.unauthorized();
  }

  return NextResponse.json(memory);
}

/** Turns memory on or off; the facts stay listed either way. */
async function updateSettings(request: NextRequest) {
  const parsed = await parseBody(request, memorySettingsUpdateSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await updateMemorySettings(parsed.data);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return NextResponse.json({ enabled: result.enabled });
}

export const GET = withApiErrorBoundary(getMemory);
export const PATCH = withApiErrorBoundary(updateSettings);
