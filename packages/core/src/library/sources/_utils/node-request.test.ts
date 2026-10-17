import { type Server, createServer } from "node:http";
import { type AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requestWithNode } from "./node-request";

describe(requestWithNode, () => {
  /** A server that takes the request and never answers it, as a stalled board site does. */
  let server: Server;
  let url: string;

  beforeAll(async () => {
    server = createServer(() => null);

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/notice.pdf`;
  });

  afterAll(async () => {
    server.closeAllConnections();

    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  it("fails a request past its deadline with the deadline's timeout, as fetch does, so a workflow step retries it", async () => {
    const failure = await requestWithNode({
      headers: {},
      signal: AbortSignal.timeout(50),
      url,
    }).catch((error: unknown) => error);

    // A step that throws an AbortError is taken for a cancellation and never retried.
    expect(failure).toMatchObject({ name: "TimeoutError" });
  });
});
