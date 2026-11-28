import { createErrorResponse, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { parseInput, readBody } from "@/lib/request-input";
import { MAX_CODE_BYTES, isCodeTooLong } from "@zoonk/core/library/activities/program-languages";
import { runLearnerProgram } from "@zoonk/core/library/activities/run-learner-program";
import {
  type CodeRunPhase,
  type CodeRunResult,
  codeRunInputSchema,
} from "@zoonk/core/library/activities/sandbox-contract";
import { after } from "next/server";
import { z } from "zod";

type RunAdmission = Awaited<ReturnType<typeof runLearnerProgram>>;

function streamRun(admission: Extract<RunAdmission, { status: "replay" | "start" }>) {
  const delivery = new AbortController();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      delivery.abort();
    },
    async start(controller) {
      function send(event: "phase" | "result", data: { phase: CodeRunPhase } | CodeRunResult) {
        if (!delivery.signal.aborted) {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        }
      }

      if (admission.status === "replay") {
        send("result", admission.result);
      } else {
        // A dropped connection must not stop a paid run before its row finishes.
        const running = admission.run((phase) => send("phase", { phase }));
        after(running);
        send("result", await running);
      }

      if (!delivery.signal.aborted) {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Cache-Control": "no-store", "Content-Type": "text/event-stream" },
  });
}

async function startCodeRun(request: Request) {
  const body = await readBody(request, z.unknown());
  const code = z.object({ code: z.string() }).safeParse(body).data?.code;

  if (code !== undefined && isCodeTooLong(code)) {
    return createErrorResponse({
      code: "CODE_TOO_LONG",
      details: { maxBytes: MAX_CODE_BYTES },
      message: "The program is longer than the largest one that runs",
      status: httpStatus.badRequest,
    });
  }

  const input = parseInput(codeRunInputSchema, body);
  const admission = await runLearnerProgram(input);

  if (admission.status === "alreadyRunning") {
    return createErrorResponse({
      code: "ALREADY_RUNNING",
      message: "A program is already running",
      status: httpStatus.conflict,
    });
  }

  if (admission.status === "replay" || admission.status === "start") {
    return streamRun(admission);
  }

  return usageDecisionError(admission);
}

export const POST = withApiErrorBoundary(startCodeRun);
