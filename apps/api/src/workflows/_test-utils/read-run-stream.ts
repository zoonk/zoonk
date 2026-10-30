import { type Run } from "workflow/api";

const STREAM_END_MS = 5000;

/** Null when the stream is still open a few seconds after the run ended. */
export async function readStreamToEnd(run: Run<unknown>): Promise<string | null> {
  let text = "";

  const sink = new WritableStream<string>({
    write: (chunk) => {
      text += chunk;
    },
  });

  const ended = await run
    .getReadable<string>()
    .pipeTo(sink, { signal: AbortSignal.timeout(STREAM_END_MS) })
    .then(
      () => true,
      () => false,
    );

  return ended ? text : null;
}
