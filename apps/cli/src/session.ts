import { loginCommand } from "./api-origin.ts";
import { type ApiRequest } from "./args.ts";
import { type LoginPlace, type StoredLogin, changeLogin, readLogin } from "./credentials.ts";
import { CliError, EXIT_CODES } from "./errors.ts";
import { type HttpResult, UNAUTHORIZED, sendRequest } from "./http.ts";
import { type RefreshResult, refreshLogin } from "./oauth.ts";

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

/**
 * A lost answer may hide a rotation the server already made. Within its reuse window the provider
 * answers the same refresh token with the same new pair, so asking once more recovers it. A refusal
 * then can mean the first refresh is still running, between rotating the token and storing that
 * answer, so it's no reason to forget the login yet.
 */
async function refreshOrReplay(place: {
  origin: string;
  refreshToken: string;
}): Promise<RefreshResult> {
  const refresh = await refreshLogin(place);

  if (refresh !== "unconfirmed") {
    return refresh;
  }

  const replay = await refreshLogin(place);
  const refused = replay !== "unconfirmed" && !replay.ok && replay.error === "invalid_grant";

  return refused ? "unconfirmed" : replay;
}

/**
 * Refreshes under the file's lock with the latest saved token: the provider rotates refresh tokens
 * and, past its reuse window, treats a rotated one as stolen and ends every CLI login of that person.
 */
async function renewLogin({ file, origin, used }: LoginPlace & { used: StoredLogin }) {
  const renewed = await changeLogin<StoredLogin | "unconfirmed" | null>({
    change: async (stored) => {
      if (!stored) {
        return { result: null };
      }

      if (stored.accessToken !== used.accessToken && !isExpiring(stored)) {
        return { result: stored };
      }

      const refresh = await refreshOrReplay({ origin, refreshToken: stored.refreshToken });

      // The next command sends the kept token again, which the reuse window answers with the new pair.
      if (refresh === "unconfirmed") {
        return { result: refresh };
      }

      if (refresh.ok) {
        return { result: refresh.login, save: refresh.login };
      }

      if (refresh.error === "invalid_grant") {
        return { result: null, save: null };
      }

      throw new CliError(
        `Couldn't renew the login for ${origin} (${refresh.error}). It's kept; try again shortly.`,
      );
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
