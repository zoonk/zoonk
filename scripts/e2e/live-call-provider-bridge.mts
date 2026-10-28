import { randomUUID } from "node:crypto";
import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import { text } from "node:stream/consumers";
import { TEST_LIVE_SDP_ANSWER } from "../../packages/e2e/src/live-call-provider.ts";

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_UNAVAILABLE = 503;

type Session = {
  id: string;
  sdp: string;
  realPeer: boolean;
  createdAt: number;
  closeRequestedAt: number | null;
  ended: boolean;
  answer: ServerResponse | null;
  hangups: Set<ServerResponse>;
  closeMode: "confirm" | "hold" | "reject";
};

type Sessions = Map<string, Session>;

async function bodyOf(
  request: IncomingMessage,
): Promise<{ closeMode: Session["closeMode"] | null; sdp: string | null }> {
  const body: unknown = JSON.parse(await text(request));

  if (!body || typeof body !== "object") {
    throw new TypeError("Invalid body");
  }

  return {
    closeMode:
      "closeMode" in body &&
      (body.closeMode === "confirm" || body.closeMode === "hold" || body.closeMode === "reject")
        ? body.closeMode
        : null,
    sdp: "sdp" in body && typeof body.sdp === "string" ? body.sdp : null,
  };
}

function json(response: ServerResponse, body: unknown, status = HTTP_OK) {
  if (response.destroyed || response.writableEnded) {
    return;
  }

  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function createSession({
  request,
  response,
  sessions,
}: {
  request: IncomingMessage;
  response: ServerResponse;
  sessions: Sessions;
}) {
  const body = await bodyOf(request);

  if (!body.sdp) {
    json(response, { error: "Missing SDP" }, HTTP_BAD_REQUEST);
    return;
  }

  const id = `live_e2e_${randomUUID()}`;
  const realPeer = !body.sdp.includes("e2e-browser-peer");

  const session: Session = {
    answer: realPeer ? response : null,
    closeMode: "confirm",
    closeRequestedAt: null,
    createdAt: Date.now(),
    ended: false,
    hangups: new Set(),
    id,
    realPeer,
    sdp: body.sdp,
  };

  sessions.set(id, session);

  if (!realPeer) {
    json(response, { sdp: TEST_LIVE_SDP_ANSWER, sessionId: id });
  }
}

/** OpenAI answers 200 once the session ends, and 404 `session_id_not_found` once it's gone. */
function hangUpSession(session: Session, response: ServerResponse) {
  session.closeRequestedAt ??= Date.now();

  if (session.ended) {
    json(
      response,
      { error: { code: "session_id_not_found", message: "No session found" } },
      HTTP_NOT_FOUND,
    );

    return;
  }

  if (session.closeMode === "reject") {
    json(response, { error: "The fake provider could not hang up" }, HTTP_UNAVAILABLE);
    return;
  }

  if (session.closeMode === "confirm") {
    session.ended = true;
    response.writeHead(HTTP_OK);
    response.end();
    return;
  }

  session.hangups.add(response);
  response.once("close", () => session.hangups.delete(response));
}

async function controlSession({
  request,
  response,
  session,
  operation,
}: {
  request: IncomingMessage;
  response: ServerResponse;
  session: Session;
  operation: string;
}) {
  const body = await bodyOf(request);

  if (operation === "behavior" && body.closeMode && !session.ended) {
    session.closeMode = body.closeMode;

    if (body.closeMode !== "hold") {
      for (const hangup of session.hangups) {
        hangUpSession(session, hangup);
      }

      session.hangups.clear();
    }

    json(response, { ok: true });
    return;
  }

  if (
    operation === "answer" &&
    body.sdp &&
    session.answer &&
    !session.answer.destroyed &&
    !session.answer.writableEnded
  ) {
    json(session.answer, { sdp: body.sdp, sessionId: session.id });
    session.answer = null;
    json(response, { ok: true });
    return;
  }

  json(response, { error: "Unexpected peer state" }, HTTP_CONFLICT);
}

async function handle({
  request,
  response,
  sessions,
}: {
  request: IncomingMessage;
  response: ServerResponse;
  sessions: Sessions;
}) {
  const path = request.url ?? "";

  if (request.method === "POST" && path === "/sessions") {
    await createSession({ request, response, sessions });
    return;
  }

  if (request.method === "GET" && path === "/control/sessions") {
    json(
      response,
      [...sessions.values()].map(({ answer, id, sdp, realPeer, closeRequestedAt, createdAt }) => ({
        awaitingAnswer: Boolean(answer && !answer.destroyed && !answer.writableEnded),
        closeRequested: closeRequestedAt !== null,
        closeRequestedAt,
        createdAt,
        id,
        realPeer,
        sdp,
      })),
    );

    return;
  }

  const route =
    /^\/(?<scope>control\/)?sessions\/(?<id>[^/]+)\/(?<operation>hangup|answer|behavior)$/u.exec(
      path,
    );

  if (request.method !== "POST" || !route?.groups?.id || !route.groups.operation) {
    json(response, { error: "Unknown test boundary operation" }, HTTP_NOT_FOUND);
    return;
  }

  const session = sessions.get(decodeURIComponent(route.groups.id));

  if (!session) {
    json(response, { error: "Unknown session" }, HTTP_NOT_FOUND);
    return;
  }

  if (!route.groups.scope && route.groups.operation === "hangup") {
    hangUpSession(session, response);
    return;
  }

  if (route.groups.scope && route.groups.operation !== "hangup") {
    await controlSession({ operation: route.groups.operation, request, response, session });
    return;
  }

  json(response, { error: "Unknown test boundary operation" }, HTTP_NOT_FOUND);
}

export async function startLiveCallTestProvider() {
  const sessions: Sessions = new Map();

  const server = createServer((request, response) => {
    void handle({ request, response, sessions }).catch(() => {
      json(response, { error: "Invalid test boundary request" }, HTTP_BAD_REQUEST);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Missing test bridge port");
  }

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    url: `http://127.0.0.1:${address.port}`,
  };
}
