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
  closedSeconds: number | null;
  answer: ServerResponse | null;
  closes: Set<ServerResponse>;
  closeMode: "confirm" | "hold" | "reject";
  rejectCloses: number;
};

type Sessions = Map<string, Session>;

async function bodyOf(
  request: IncomingMessage,
): Promise<{
  closeMode: Session["closeMode"] | null;
  rejectCloses: number | null;
  sdp: string | null;
  seconds: number | null;
}> {
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
    rejectCloses:
      "rejectCloses" in body &&
      typeof body.rejectCloses === "number" &&
      Number.isSafeInteger(body.rejectCloses) &&
      body.rejectCloses >= 0
        ? body.rejectCloses
        : null,
    sdp: "sdp" in body && typeof body.sdp === "string" ? body.sdp : null,
    seconds:
      "seconds" in body &&
      typeof body.seconds === "number" &&
      Number.isFinite(body.seconds) &&
      body.seconds >= 0
        ? body.seconds
        : null,
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
    closeMode: realPeer ? "hold" : "confirm",
    closeRequestedAt: null,
    closedSeconds: null,
    closes: new Set(),
    createdAt: Date.now(),
    id,
    realPeer,
    rejectCloses: 0,
    sdp: body.sdp,
  };

  sessions.set(id, session);

  if (!realPeer) {
    json(response, { sdp: TEST_LIVE_SDP_ANSWER, sessionId: id });
  }
}

function closeSession(session: Session, response: ServerResponse) {
  session.closeRequestedAt ??= Date.now();

  if (session.closedSeconds !== null) {
    json(response, { reason: "close_requested", seconds: session.closedSeconds, status: "closed" });
    return;
  }

  if (session.closeMode === "reject" || session.rejectCloses > 0) {
    session.rejectCloses = Math.max(0, session.rejectCloses - 1);
    json(response, { error: "The fake provider could not confirm termination" }, HTTP_UNAVAILABLE);
    return;
  }

  if (session.closeMode === "confirm") {
    session.closedSeconds = 15;
  }

  if (session.closedSeconds !== null) {
    json(response, { reason: "close_requested", seconds: session.closedSeconds, status: "closed" });
    return;
  }

  session.closes.add(response);
  response.once("close", () => session.closes.delete(response));
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

  if (
    operation === "behavior" &&
    body.closeMode &&
    !session.realPeer &&
    session.closedSeconds === null
  ) {
    session.closeMode = body.closeMode;
    session.rejectCloses = body.rejectCloses ?? 0;

    if (body.closeMode !== "hold") {
      for (const close of session.closes) {
        closeSession(session, close);
      }

      session.closes.clear();
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

  if (operation === "closed" && session.closeRequestedAt !== null && body.seconds !== null) {
    session.closedSeconds ??= body.seconds;

    for (const close of session.closes) {
      json(close, { reason: "close_requested", seconds: session.closedSeconds, status: "closed" });
    }

    session.closes.clear();
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
    /^\/(?<scope>control\/)?sessions\/(?<id>[^/]+)\/(?<operation>close|answer|closed|behavior)$/u.exec(
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

  if (!route.groups.scope && route.groups.operation === "close") {
    closeSession(session, response);
    return;
  }

  if (route.groups.scope && route.groups.operation !== "close") {
    await controlSession({ operation: route.groups.operation, request, response, session });
    return;
  }

  json(response, { error: "Unknown test boundary operation" }, HTTP_NOT_FOUND);
}

/** Lane-owned AI boundary fake, never OpenAI evidence. Native browser peers answer SDP and acknowledge closes. */
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
