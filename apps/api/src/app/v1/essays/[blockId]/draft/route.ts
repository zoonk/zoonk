import { errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { essayPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { saveWritingDraft } from "@zoonk/core/exams/essays/save-writing-draft";
import { saveWritingDraftSchema } from "@zoonk/core/exams/essays/writing-contract";
import { NextResponse } from "next/server";

async function putDraft(request: Request, context: { params: Promise<{ blockId: string }> }) {
  const [path, input] = await Promise.all([
    readPathParams(context, essayPathParamsSchema),
    readBody(request, saveWritingDraftSchema),
  ]);

  const result = await saveWritingDraft({ blockId: path.blockId, input });

  switch (result.status) {
    case "ready":
      return NextResponse.json(result.draft);
    case "conflict":
      return NextResponse.json(result.draft, { status: httpStatus.conflict });
    case "alreadySubmitted":
      return errors.conflict("This answer has already been submitted");
    case "notFound":
    case "unauthorized":
      return examError(result);
    default:
      return result satisfies never;
  }
}

export const PUT = withApiErrorBoundary(putDraft);
