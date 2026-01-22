import { getWritable } from "workflow";

type WorkflowRun<TResult> = {
  getReadable: <T>() => ReadableStream<T>;
  returnValue: Promise<TResult>;
};

/**
 * Runs a nested workflow and forwards its stream to the parent workflow.
 * Use this when you need the nested workflow's status updates to appear
 * in the parent workflow's stream.
 */
export async function runNestedWorkflow<TResult>(
  run: WorkflowRun<TResult>,
): Promise<TResult> {
  const parentWritable = getWritable<string>();
  const nestedReadable = run.getReadable<string>();

  await nestedReadable.pipeTo(parentWritable, { preventClose: true });

  return run.returnValue;
}
