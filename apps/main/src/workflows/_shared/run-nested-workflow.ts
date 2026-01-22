import { getWritable } from "workflow";

type WorkflowRun<TResult> = {
  getReadable: <T>() => ReadableStream<T>;
  returnValue: Promise<TResult>;
};

async function forwardStream(readable: ReadableStream<string>): Promise<void> {
  const reader = readable.getReader();

  try {
    // biome-ignore lint/correctness/noUnnecessaryCondition: standard stream reading pattern
    while (true) {
      // biome-ignore lint/performance/noAwaitInLoops: must read sequentially from stream
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        const parentWritable = getWritable<string>();
        const parentWriter = parentWritable.getWriter();
        try {
          await parentWriter.write(value);
        } finally {
          parentWriter.releaseLock();
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Runs a nested workflow and forwards its stream to the parent workflow.
 * Use this when you need the nested workflow's status updates to appear
 * in the parent workflow's stream.
 */
export async function runNestedWorkflow<TResult>(
  run: WorkflowRun<TResult>,
): Promise<TResult> {
  "use step";

  const nestedReadable = run.getReadable<string>();

  // Forward stream in background - don't block on it
  forwardStream(nestedReadable).catch(() => {
    // Stream may close abruptly when workflow completes - that's OK
  });

  // Wait for the workflow result
  return run.returnValue;
}
