import { createErrorResponse, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { readBody } from "@/lib/request-input";
import { runLearnerProgram } from "@zoonk/core/library/activities/run-learner-program";
import {
  type CodeRunPhase,
  type CodeRunResult,
  codeRunInputSchema,
} from "@zoonk/core/library/activities/sandbox-contract";

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

      const result =
        admission.status === "replay"
          ? admission.result
          : await admission.run((phase) => send("phase", { phase }));

      send("result", result);

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
  const input = await readBody(request, codeRunInputSchema);
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
