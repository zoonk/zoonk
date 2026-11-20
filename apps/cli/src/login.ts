import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { loginCommand } from "./api-origin.ts";
import { type LoginPlace, type StoredLogin, changeLogin, saveLogin } from "./credentials.ts";
import { CliError } from "./errors.ts";
import { type DeviceCode, exchangeDeviceCode, requestDeviceCode, revokeLogin } from "./oauth.ts";

/** RFC 8628 section 3.5: each slow_down adds 5 seconds to the polling interval. */
const SLOW_DOWN_SECONDS = 5;

function browserCommand(): string | null {
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY) {
    return null;
  }

  if (process.platform === "darwin") {
    return "open";
  }

  if (process.platform === "linux" && (process.env.DISPLAY || process.env.WAYLAND_DISPLAY)) {
    return "xdg-open";
  }

  return null;
}

function openBrowser(url: string) {
  const command = browserCommand();

  if (!command) {
    return;
  }

  const child = spawn(command, [url], { detached: true, stdio: "ignore" });
  child.on("error", () => null);
  child.unref();
}

async function waitForApproval({
  deadline,
  deviceCode,
  intervalSeconds,
  origin,
}: {
  deadline: number;
  deviceCode: string;
  intervalSeconds: number;
  origin: string;
}): Promise<StoredLogin> {
  await delay(intervalSeconds * 1000);

  if (Date.now() > deadline) {
    throw new CliError(`The code expired. Run \`${loginCommand(origin)}\` again.`);
  }

  const result = await exchangeDeviceCode({ deviceCode, origin });

  if (result.ok) {
    return result.login;
  }

  switch (result.error) {
    case "authorization_pending":
      return waitForApproval({ deadline, deviceCode, intervalSeconds, origin });
    // Better Auth's rate limiter answers 429 rather than slow_down.
    case "HTTP 429":
    case "slow_down":
      return waitForApproval({
        deadline,
        deviceCode,
        intervalSeconds: intervalSeconds + SLOW_DOWN_SECONDS,
        origin,
      });
    case "expired_token":
      throw new CliError(`The code expired. Run \`${loginCommand(origin)}\` again.`);
    case "access_denied":
      throw new CliError(
        "The login was denied in the browser. Only a Zoonk staff account can approve it. " +
          `To try again, run \`${loginCommand(origin)}\`.`,
      );
    default:
      throw new CliError(`The login failed (${result.error}).`);
  }
}

function showCode(code: DeviceCode) {
  process.stderr.write(
    [
      `Open ${code.verificationUri} and enter the code ${code.userCode}`,
      code.verificationUriComplete && `(or open ${code.verificationUriComplete})`,
      "Waiting for approval…",
      "",
    ]
      .filter((line) => typeof line === "string")
      .join("\n"),
  );
}

export async function logIn({ file, origin }: LoginPlace) {
  const code = await requestDeviceCode(origin);

  showCode(code);
  openBrowser(code.verificationUriComplete ?? code.verificationUri);

  const login = await waitForApproval({
    deadline: Date.now() + code.expiresInSeconds * 1000,
    deviceCode: code.deviceCode,
    intervalSeconds: code.intervalSeconds,
    origin,
  });

  await saveLogin({ file, login, origin });
  process.stderr.write(`Logged in to ${origin}.\n`);
}

/** Revokes under the file's lock: revoking a token another command just rotated ends every login. */
export async function logOut({ file, origin }: LoginPlace) {
  const revocation = await changeLogin({
    change: async (stored) => {
      if (!stored) {
        return { result: null };
      }

      return {
        result: await revokeLogin({ origin, refreshToken: stored.refreshToken }),
        save: null,
      };
    },
    file,
    origin,
  });

  if (revocation === null) {
    process.stderr.write(`Not logged in to ${origin}, so there was nothing to log out of.\n`);
    return;
  }

  if (revocation === "unconfirmed") {
    throw new CliError(
      `Logged out on this machine, but ${origin} didn't confirm it revoked the login. ` +
        "You can revoke it on Admin's CLI logins page.",
    );
  }

  const alreadyRevoked = revocation === "alreadyRevoked" ? " The login was already revoked." : "";
  process.stderr.write(`Logged out of ${origin}.${alreadyRevoked}\n`);
}
