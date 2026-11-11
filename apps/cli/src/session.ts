import { loginCommand } from "./api-origin.ts";
import { type ApiRequest } from "./args.ts";
import {
  type LoginPlace,
  type StoredLogin,
  readLogin,
  removeLogin,
  saveLogin,
} from "./credentials.ts";
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

/**
 * Reads the file again right before refreshing: the provider rotates refresh tokens and, past its
 * short reuse window, treats a rotated one as stolen and ends every CLI login of that person.
 */
async function renewLogin({ file, origin, used }: LoginPlace & { used: StoredLogin }) {
  const stored = readLogin({ file, origin });

  if (!stored) {
    throw notLoggedIn(origin);
  }

  if (stored.accessToken !== used.accessToken && !isExpiring(stored)) {
    return stored;
  }

  const result = await refreshLogin({ origin, refreshToken: stored.refreshToken });

  if (!result.ok) {
    removeLogin({ file, origin, refreshToken: stored.refreshToken });
    throw notLoggedIn(origin);
  }

  saveLogin({ file, login: result.login, origin });
  return result.login;
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
