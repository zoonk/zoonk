import { getWritable } from "workflow";

/**
 * Runs a nested workflow and forwards its stream to the parent workflow.
 * Use this when you need the nested workflow's status updates to appear
 * in the parent workflow's stream.
 */
export async function runNestedWorkflow<TResult>(run: {
  getReadable: <T>() => ReadableStream<T>;
  returnValue: Promise<TResult>;
}): Promise<TResult> {
  "use step";

  const parentWritable = getWritable<string>();
  const nestedReadable = run.getReadable<string>();

  nestedReadable.pipeTo(parentWritable, { preventClose: true }).catch(() => {
    // Errors are intentionally swallowed - the nested workflow's returnValue
    // Will propagate any meaningful errors. Stream piping errors are not actionable.
    // If we `await` here, then the workflow would hang forever.
  });

  return run.returnValue;
}
