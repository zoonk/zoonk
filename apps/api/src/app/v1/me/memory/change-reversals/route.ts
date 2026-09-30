import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { memoryErrorCodes } from "@/lib/memory-error-codes";
import { memoryUndoInputSchema } from "@zoonk/core/memory/contract";
import { undoMemoryChanges } from "@zoonk/core/memory/undo";
import { type NextRequest, NextResponse } from "next/server";

/** Undoes what a "Memory updated" notice or a delete showed, all together or not at all. */
async function reverseChanges(request: NextRequest) {
  const parsed = await parseBody(request, memoryUndoInputSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await undoMemoryChanges(parsed.data);

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
