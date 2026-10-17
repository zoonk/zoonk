const HTTP_OK = 200;

/**
 * A JSON answer whose status and headers are in at once and whose body arrives only when `finish`
 * runs: what a learner's browser holds while a slow answer is still being read. `status` is the
 * answer's HTTP status (200 unless it's a refusal or an error).
 */
export function heldJsonAnswer(body: unknown, status = HTTP_OK) {
  const finished = Promise.withResolvers<null>();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      await finished.promise;
      controller.enqueue(new TextEncoder().encode(JSON.stringify(body)));
      controller.close();
    },
  });

  return { finish: () => finished.resolve(null), response: new Response(stream, { status }) };
}
