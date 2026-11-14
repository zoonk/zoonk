import { loginCommand, resolveApiOrigin } from "./api-origin.ts";
import { type ApiRequest, WHOAMI_REQUEST, parseInvocation } from "./args.ts";
import { credentialsPath } from "./credentials.ts";
import { CliError, EXIT_CODES } from "./errors.ts";
import { HELP } from "./help.ts";
import {
  BAD_REQUEST,
  FORBIDDEN,
  type HttpResult,
  UNAUTHORIZED,
  isRecord,
  unexpectedResponse,
} from "./http.ts";
import { logIn, logOut } from "./login.ts";
import { type OutputShape, shapeOutput } from "./output.ts";
import { notLoggedIn, sendAuthorized } from "./session.ts";

function apiError({ origin, result }: { origin: string; result: HttpResult }): CliError {
  if (result.status === UNAUTHORIZED) {
    return notLoggedIn(origin);
  }

  const error = isRecord(result.body) && isRecord(result.body.error) ? result.body.error : null;

  if (result.status === FORBIDDEN && error?.code === "SCOPE_REQUIRED") {
    return new CliError(
      `This login to ${origin} can only read. Log in again to propose or withdraw content fixes: ` +
        `\`${loginCommand(origin)}\`.`,
    );
  }

  if (result.status === FORBIDDEN && error?.code !== "NOT_PROPOSER") {
    return new CliError(
      `This login to ${origin} has no staff access. Log in with a Zoonk staff account: ` +
        `\`${loginCommand(origin)}\`.`,
    );
  }

  if (typeof error?.message !== "string") {
    return unexpectedResponse(result);
  }

  const details = error.details === undefined ? "" : `\n${JSON.stringify(error.details, null, 2)}`;

  return new CliError(
    `${error.message} (HTTP ${result.status})${details}`,
    result.status === BAD_REQUEST ? EXIT_CODES.usage : EXIT_CODES.failed,
  );
}

async function runRequest({
  file,
  origin,
  request,
  shape,
}: {
  file: string;
  origin: string;
  request: ApiRequest;
  shape?: OutputShape;
}) {
  const result = await sendAuthorized({ file, origin, request });

  if (!result.ok) {
    throw apiError({ origin, result });
  }

  if (!isRecord(result.body)) {
    throw unexpectedResponse(result);
  }

  process.stdout.write(`${JSON.stringify(shapeOutput({ body: result.body, shape }), null, 2)}\n`);
}

async function run(argv: string[]) {
  const { apiUrl, command } = parseInvocation(argv);

  if (command.name === "help") {
    process.stdout.write(HELP);
    return;
  }

  const origin = resolveApiOrigin(apiUrl ?? process.env.ZOONK_API_URL);
  const file = credentialsPath(process.env);

  if (command.name === "logout") {
    await logOut({ file, origin });
    return;
  }

  if (command.name === "login") {
    await logIn({ file, origin });
    await runRequest({ file, origin, request: WHOAMI_REQUEST });
    return;
  }

  await runRequest({ file, origin, request: command.request, shape: command.shape });
}

try {
  await run(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = error instanceof CliError ? error.exitCode : EXIT_CODES.failed;
}
