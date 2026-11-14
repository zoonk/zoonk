import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import {
  contentFixBatchDecisionRequestSchema,
  contentFixBatchPathParamsSchema,
} from "@/lib/openapi/schemas/content-fixes";
import { readBody, readPathParams } from "@/lib/request-input";
import { approveContentFixes, resumeContentFixes } from "@zoonk/core/staff/content-fixes/decide";
import { rejectContentFixBatch } from "@zoonk/core/staff/content-fixes/reject";
import { NextResponse } from "next/server";
import { type z } from "zod";

function decide({
  batchId,
  body,
}: {
  batchId: string;
  body: z.infer<typeof contentFixBatchDecisionRequestSchema>;
}) {
  switch (body.decision) {
    case "approve":
      return approveContentFixes({ assertion: body.assertion, batchId });
    case "resume":
      return resumeContentFixes(batchId);
    case "reject":
      return rejectContentFixBatch(batchId);
    default:
      return body satisfies never;
  }
}

async function createDecision(
  request: Request,
  context: RouteContext<"/v1/content-fix-batches/[batchId]/decisions">,
) {
  const [path, body] = await Promise.all([
    readPathParams(context, contentFixBatchPathParamsSchema),
    readBody(request, contentFixBatchDecisionRequestSchema),
  ]);

  const result = await decide({ batchId: path.batchId, body });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "forbidden") {
    return errors.forbidden();
  }

  if (result.status === "notFound") {
    return errors.notFound("Content fix batch not found");
  }

  return NextResponse.json(result);
}

export const POST = withApiErrorBoundary(createDecision);
