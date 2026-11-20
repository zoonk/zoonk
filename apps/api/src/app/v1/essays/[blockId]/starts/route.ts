import { errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { essayPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { ensureWritingPrompts } from "@/workflows/sessions/writing-prompt-workflow";
import { startWriting } from "@zoonk/core/exams/essays/start-writing";
import { writingStartInputSchema } from "@zoonk/core/exams/essays/writing-contract";
import { canFundWritingPrompts } from "@zoonk/core/library/items/writing-prompt-spend";
import { NextResponse } from "next/server";

async function postStart(request: Request, context: { params: Promise<{ blockId: string }> }) {
  const [path, input] = await Promise.all([
    readPathParams(context, essayPathParamsSchema),
    readBody(request, writingStartInputSchema),
  ]);

  const result = await startWriting({ blockId: path.blockId, ...input });

  switch (result.status) {
    case "ready":
      return NextResponse.json(result);
    case "limitReached":
      return NextResponse.json(result, { status: httpStatus.tooManyRequests });
    case "invalidRewrite":
      return errors.conflict("Choose the latest answer to rewrite");
    case "needsPrompt": {
      if (!(await canFundWritingPrompts(result.input.userId, result.input.count))) {
        return examError({ status: "signUpRequired" });
      }

      const supply = await ensureWritingPrompts(result.input);

      if (supply.status === "writing") {
        return NextResponse.json(supply, {
          headers: { Location: `/v1/generations/${encodeURIComponent(supply.runId)}` },
          status: 202,
        });
      }

      const replay = await startWriting({ blockId: path.blockId, ...input });

      if (replay.status === "ready") {
        return NextResponse.json(replay);
      }

      if (replay.status === "limitReached") {
        return NextResponse.json(replay, { status: httpStatus.tooManyRequests });
      }

      return errors.conflict("Start writing again");
    }
    case "blockNotActive":
    case "notFound":
    case "unauthorized":
      return examError(result);
    default:
      return result satisfies never;
  }
}

export const POST = withApiErrorBoundary(postStart);
