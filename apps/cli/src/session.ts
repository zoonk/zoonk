import { loginCommand } from "./api-origin.ts";
import { type ApiRequest } from "./args.ts";
import { type LoginPlace, type StoredLogin, changeLogin, readLogin } from "./credentials.ts";
import { CliError, EXIT_CODES } from "./errors.ts";
import { type HttpResult, UNAUTHORIZED, sendRequest } from "./http.ts";
import { refreshLogin } from "./oauth.ts";

const EXPIRY_MARGIN_MS = 60_000;

export function notLoggedIn(origin: string): CliError {
  return new CliError(
    `Not logged in to ${origin}. Run \`${loginCommand(origin)}\`.`,
    EXIT_CODES.notLoggedIn,
  );
}

function isExpiring(login: StoredLogin): boolean {
  return login.expiresAt - Date.now() < EXPIRY_MARGIN_MS;
}

/** Kept off the end of the server's replay window, for a request to reach the server in time. */
const REPLAY_MARGIN_MS = 30_000;

type Renewal = StoredLogin | "unconfirmed" | null;

/** A server that never said it replays rotated tokens gets none sent again. */
function canReplay(login: StoredLogin, maybeRotatedAt: number): boolean {
  const windowMs = (login.replaySeconds ?? 0) * 1000;
  return Date.now() - maybeRotatedAt < windowMs - REPLAY_MARGIN_MS;
}

/**
 * Once the server may have rotated the token, any answer but a new pair keeps the login: the
 * provider answers that token with the same new pair until its reuse window ends, and refuses it
 * while the refresh that rotated it is still storing that answer. Past the window, sending it
 * would end every CLI login of that person, so the login is forgotten here instead.
 */
async function refreshStored({
  origin,
  stored,
}: {
  origin: string;
  stored: StoredLogin;
}): Promise<{ result: Renewal; save?: StoredLogin | null }> {
  if (stored.maybeRotatedAt !== undefined && !canReplay(stored, stored.maybeRotatedAt)) {
    return { result: null, save: null };
  }

  const maybeRotatedAt = stored.maybeRotatedAt ?? Date.now();
  const place = { origin, refreshToken: stored.refreshToken };
  const first = await refreshLogin(place);

  if (first !== "unconfirmed" && !first.ok && stored.maybeRotatedAt === undefined) {
    if (first.error === "invalid_grant") {
      return { result: null, save: null };
    }

    throw new CliError(
      `Couldn't renew the login for ${origin} (${first.error}). It's kept; try again shortly.`,
    );
  }

  // Failing to send the retry still leaves a token the first refresh may have rotated.
  const answer =
    first === "unconfirmed" && canReplay(stored, maybeRotatedAt)
      ? await refreshLogin(place).catch(() => "unconfirmed" as const)
      : first;

  if (answer !== "unconfirmed" && answer.ok) {
    return { result: answer.login, save: answer.login };
  }

  return canReplay(stored, maybeRotatedAt)
    ? { result: "unconfirmed", save: { ...stored, maybeRotatedAt } }
    : { result: null, save: null };
}

/** Refreshes under the file's lock with the latest saved token, so two commands never both send it. */
async function renewLogin({ file, origin, used }: LoginPlace & { used: StoredLogin }) {
  const renewed = await changeLogin<Renewal>({
    change: async (stored) => {
      if (!stored) {
        return { result: null };
      }

      if (stored.accessToken !== used.accessToken && !isExpiring(stored)) {
        return { result: stored };
      }

      return refreshStored({ origin, stored });
    },
    file,
    origin,
  });

  if (renewed === "unconfirmed") {
    throw new CliError(
      `Couldn't confirm the login renewal with ${origin}. It's kept; try again shortly.`,
    );
  }

  if (!renewed) {
    throw notLoggedIn(origin);
  }

  return renewed;
}

async function currentLogin({ file, origin }: LoginPlace): Promise<StoredLogin> {
  const login = readLogin({ file, origin });

  if (!login) {
    throw notLoggedIn(origin);
  }

  return isExpiring(login) ? renewLogin({ file, origin, used: login }) : login;
}

function send({
  login,
  origin,
  request,
}: {
  login: StoredLogin;
  origin: string;
  request: ApiRequest;
}): Promise<HttpResult> {
  const url = new URL(request.path, origin);
  const authorization = { authorization: `Bearer ${login.accessToken}` };

  if (request.method === "GET") {
    return sendRequest(url, { headers: authorization, method: "GET" });
  }

  return sendRequest(url, {
    body: JSON.stringify(request.body),
    headers: { ...authorization, "content-type": "application/json" },
    method: "POST",
  });
}

export async function sendAuthorized({
  file,
  origin,
  request,
}: LoginPlace & { request: ApiRequest }): Promise<HttpResult> {
  const login = await currentLogin({ file, origin });
  const result = await send({ login, origin, request });

  if (result.status !== UNAUTHORIZED) {
    return result;
  }

  const renewed = await renewLogin({ file, origin, used: login });
  return send({ login: renewed, origin, request });
}
