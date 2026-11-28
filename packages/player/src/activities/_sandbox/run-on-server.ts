import { type CodeRunOutcome, type RunCode } from "../../lesson/lesson-player-types";

const ASK_AGAIN_MS = 1000;

type ServerRunOutcome = Exclude<CodeRunOutcome, { status: "alreadyRunning" }>;

/**
 * A learner runs one program at a time, on any device, so "already running" waits and asks again
 * under the same request: that request's own run answers once it ends, and a run of another device
 * lets this one start once it ends. The server ends a lost run, so the asking ends too.
 */
export async function runOnServer({
  keepWaiting,
  runCode,
  ...input
}: Parameters<RunCode>[0] & {
  keepWaiting: () => boolean;
  runCode: RunCode | undefined;
}): Promise<ServerRunOutcome> {
  if (!runCode) {
    return { status: "unavailable" };
  }

  const outcome = await runCode(input);

  if (outcome.status !== "alreadyRunning") {
    return outcome;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, ASK_AGAIN_MS);
  });

  return keepWaiting()
    ? runOnServer({ keepWaiting, runCode, ...input })
    : { status: "unavailable" };
}
