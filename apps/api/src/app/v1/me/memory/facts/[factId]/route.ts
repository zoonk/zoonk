import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { memoryFactPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { memoryFactUpdateSchema } from "@zoonk/core/memory/contract";
import { deleteMemoryFact } from "@zoonk/core/memory/delete-fact";
import { updateMemoryFact } from "@zoonk/core/memory/update-fact";
import { type NextRequest, NextResponse } from "next/server";

type FactContext = RouteContext<"/v1/me/memory/facts/[factId]">;

/** Saves the learner's correction of one fact. */
async function updateFact(request: NextRequest, context: FactContext) {
  const [body, path] = await Promise.all([
    readBody(request, memoryFactUpdateSchema),
    readPathParams(context, memoryFactPathParamsSchema),
  ]);

  const result = await updateMemoryFact({ factId: path.factId, input: body });

  if (result.status !== "updated") {
    return result.status === "unauthorized" ? errors.unauthorized() : errors.notFound();
  }

  return NextResponse.json({ fact: result.fact });
}

/** Deletes one fact with the facts it replaced; the returned change undoes it. */
async function deleteFact(_request: NextRequest, context: FactContext) {
  const path = await readPathParams(context, memoryFactPathParamsSchema);

  const result = await deleteMemoryFact(path.factId);

  if (result.status !== "deleted") {
    return result.status === "unauthorized" ? errors.unauthorized() : errors.notFound();
  }

  return NextResponse.json({ change: result.change });
}

export const POST = withApiErrorBoundary(updateFact);
export const DELETE = withApiErrorBoundary(deleteFact);
