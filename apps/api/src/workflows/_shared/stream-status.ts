import { type StepStreamMessage } from "@zoonk/core/workflows/steps";
import { getWritable } from "workflow";

type StepStream<T extends string> = {
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

    async status(params: StepStreamMessage<T>) {
      await writeSSE(writer, { ...params, at: Date.now() });
    },
  };
}

/** Workflow code can't touch streams, so events the workflow itself decides on go through this step. */
export async function progressStep<T extends string>(message: StepStreamMessage<T>): Promise<void> {
  "use step";

  await using stream = createStepStream<T>();
  await stream.status(message);
}
