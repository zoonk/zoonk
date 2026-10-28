import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { memoryErrorCodes } from "@/lib/memory-error-codes";
import { readBody } from "@/lib/request-input";
import { memoryUndoInputSchema } from "@zoonk/core/memory/contract";
import { undoMemoryChanges } from "@zoonk/core/memory/undo";
import { type NextRequest, NextResponse } from "next/server";

async function reverseChanges(request: NextRequest) {
  const parsed = await readBody(request, memoryUndoInputSchema);

  const result = await undoMemoryChanges(parsed);

  if (result.status === "undone") {
    return NextResponse.json({ removedFactIds: result.removedFactIds, restored: result.restored });
  }

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return createErrorResponse({
    code: memoryErrorCodes.changeAlreadyUndone,
    message: "One of these changes was already undone or has changed since",
    status: httpStatus.conflict,
  });
}

export const POST = withApiErrorBoundary(reverseChanges);
