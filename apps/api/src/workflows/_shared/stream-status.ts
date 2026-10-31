import { type StepStreamMessage } from "@zoonk/core/workflows/steps";
import { getWritable } from "workflow";

type StepStream<T extends string> = {
  close: () => Promise<void>;
  status: (params: StepStreamMessage<T>) => Promise<void>;
  [Symbol.asyncDispose]: () => Promise<void>;
};

async function writeSSE(
  writer: WritableStreamDefaultWriter<string>,
  data: Record<string, unknown>,
): Promise<void> {
  await writer.write(`data: ${JSON.stringify(data)}\n\n`);
}

/** Hold it with `await using`: that releases the stream's writer lock when the step ends. */
export function createStepStream<T extends string>(): StepStream<T> {
  const writer = getWritable<string>().getWriter();

  return {
    async [Symbol.asyncDispose]() {
      writer.releaseLock();
    },

    async close() {
      await writer.close();
    },

    async status(params: StepStreamMessage<T>) {
      await writeSSE(writer, { ...params, at: Date.now() });
    },
  };
}

/**
 * Workflow code can't touch streams, so events the workflow itself decides on go through this step.
 * `last` ends the run's stream with this event, which the SDK doesn't do when the run ends
 * (vercel/workflow#964): nothing can write to it after, and every way a run ends, a step that gives
 * up included, needs one or its readers wait out the function's time limit.
 */
export async function progressStep<T extends string>(
  message: StepStreamMessage<T>,
  { last = false }: { last?: boolean } = {},
): Promise<void> {
  "use step";

  await using stream = createStepStream<T>();
  await stream.status(message);

  if (last) {
    await stream.close();
  }
}
