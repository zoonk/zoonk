import { type IncomingMessage, get as httpGet } from "node:http";
import { type RequestOptions, get as httpsGet } from "node:https";
import { type LookupFunction } from "node:net";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

/** The statuses a Response can be built with. */
const MIN_STATUS = 200;
const MAX_STATUS = 599;
/** Responses with these statuses carry no body, and a Response built with one throws. */
const NULL_BODY_STATUSES = new Set(["204", "205", "304"]);

type NodeRequest = {
  /** Replaces Node's default certificate authorities for this request. */
  ca?: string[];
  headers: Record<string, string>;
  /** Resolves host names; tests point public names at a local server. */
  lookup?: LookupFunction;
  signal: AbortSignal;
  url: string;
};

function toHeaders(message: IncomingMessage): Headers {
  return new Headers(
    Object.entries(message.headersDistinct).flatMap(([name, values = []]) =>
      values.map((value): [string, string] => [name, value]),
    ),
  );
}

/**
 * Streams Node's response as a fetch body, paused while the reader is behind. A failure on either
 * side reaches the other (the reader sees Node's error; a cancelled read destroys the response),
 * so the pipeline's own rejection has nothing left to report.
 */
function toBody(message: IncomingMessage): ReadableStream<Uint8Array> {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();

  pipeline(message, Writable.fromWeb(writable)).catch(() => null);

  return readable;
}

function receiveResponse({ ca, headers, lookup, signal, url }: NodeRequest) {
  const options: RequestOptions = {
    agent: false,
    ca,
    headers: { accept: "*/*", "accept-encoding": "identity", ...headers },
    lookup,
    signal,
  };

  return new Promise<IncomingMessage>((resolve, reject) => {
    const request = url.startsWith("https:")
      ? httpsGet(url, options, resolve)
      : httpGet(url, options, resolve);

    request.on("error", reject);
  });
}

/**
 * The global fetch can't trust an extra certificate authority for one request, so a request that
 * needs one goes through Node's own client and comes back as a fetch Response, read the same way.
 * Like fetch with `redirect: "manual"`, it never follows a redirect. It asks for an uncompressed
 * body since, unlike fetch, it doesn't decompress one.
 */
export async function requestWithNode(request: NodeRequest): Promise<Response> {
  const message = await receiveResponse(request);
  const status = message.statusCode ?? 0;

  if (status < MIN_STATUS || status > MAX_STATUS) {
    message.destroy();
    throw new Error(`${request.url} answered with an invalid status: ${status}`);
  }

  const body = NULL_BODY_STATUSES.has(String(status)) ? null : toBody(message);

  return new Response(body, { headers: toHeaders(message), status });
}
