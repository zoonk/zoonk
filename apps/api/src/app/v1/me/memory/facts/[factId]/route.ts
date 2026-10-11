import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { memoryFactPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { memoryFactUpdateSchema } from "@zoonk/core/memory/contract";
import { deleteMemoryFact } from "@zoonk/core/memory/delete-fact";
import { updateMemoryFact } from "@zoonk/core/memory/update-fact";
import { type NextRequest, NextResponse } from "next/server";

type FactContext = RouteContext<"/v1/me/memory/facts/[factId]">;

function parseFactPath(context: FactContext) {
  return context.params.then((params) =>
    parsePathParams({ params, schema: memoryFactPathParamsSchema }),
  );
}

/** Saves the learner's correction of one fact. */
async function updateFact(request: NextRequest, context: FactContext) {
  const [body, path] = await Promise.all([
    parseBody(request, memoryFactUpdateSchema),
    parseFactPath(context),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await updateMemoryFact({ factId: path.data.factId, input: body.data });

  if (result.status !== "updated") {
    return result.status === "unauthorized" ? errors.unauthorized() : errors.notFound();
  }

  return NextResponse.json({ fact: result.fact });
}

/** Deletes one fact with the facts it replaced; the returned change undoes it. */
async function deleteFact(_request: NextRequest, context: FactContext) {
  const path = await parseFactPath(context);

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await deleteMemoryFact(path.data.factId);

  if (result.status !== "deleted") {
    return result.status === "unauthorized" ? errors.unauthorized() : errors.notFound();
  }

  return NextResponse.json({ change: result.change });
}

export const PATCH = withApiErrorBoundary(updateFact);
export const DELETE = withApiErrorBoundary(deleteFact);
