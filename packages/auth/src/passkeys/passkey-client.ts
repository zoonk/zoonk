import { passkeyClient } from "@better-auth/passkey/client";
import { getString } from "@zoonk/utils/json";
import { type BetterAuthClientPlugin, createAuthClient } from "better-auth/client";
import { BETTER_AUTH_BASE_PATH } from "../config";
import { type passkeyChangePlugin } from "../plugins/passkey-change";
import { signWithPasskey } from "./passkey-browser";
import { type PasskeyChange } from "./passkey-change-contract";

const passkeyChangeClient = {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Better Auth reads only this field's type, for the server plugin's endpoints
  $InferServerPlugin: {} as ReturnType<typeof passkeyChangePlugin>,
  id: "passkey-change",
} satisfies BetterAuthClientPlugin;

/** Its own client, so only the page that manages passkeys loads the browser's WebAuthn code. */
const client = createAuthClient({
  basePath: BETTER_AUTH_BASE_PATH,
  plugins: [passkeyClient(), passkeyChangeClient],
});

/**
 * `signInAgain`: adding a passkey needs a session started in the last day. `notConfirmed`: an
 * existing passkey didn't confirm the change, which every change after the first passkey needs.
 */
export type PasskeyChangeFailure =
  | "alreadyAdded"
  | "cancelled"
  | "failed"
  | "notConfirmed"
  | "signInAgain";

export type AddedPasskey = { createdAt: Date; id: string; name: string | null };

const FAILURES_BY_CODE: Partial<Record<string, PasskeyChangeFailure>> = {
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: "alreadyAdded",
  ERROR_CEREMONY_ABORTED: "cancelled",
  PASSKEY_CONFIRMATION_REQUIRED: "notConfirmed",
  SESSION_NOT_FRESH: "signInAgain",
};

function toFailure(error: unknown): PasskeyChangeFailure {
  return FAILURES_BY_CODE[getString(error, "code") ?? ""] ?? "failed";
}

/** Null once the change may go ahead: confirmed by an existing passkey, or the account has none yet. */
async function confirmChange(change: PasskeyChange): Promise<PasskeyChangeFailure | null> {
  const started = await client.passkeyChange.options(change);

  if (!started.data) {
    return "failed";
  }

  if (!started.data.options) {
    return null;
  }

  const assertion = await signWithPasskey(started.data.options);

  if (!assertion) {
    return "notConfirmed";
  }

  const confirmed = await client.passkeyChange.approval({ assertion, change });
  return confirmed.data ? null : "notConfirmed";
}

export async function addPasskey(): Promise<
  { passkey: AddedPasskey; status: "added" } | { status: PasskeyChangeFailure }
> {
  const refused = await confirmChange({ action: "add" });

  if (refused) {
    return { status: refused };
  }

  const added = await client.passkey.addPasskey();

  if (!added.data) {
    return { status: toFailure(added.error) };
  }

  const { createdAt, id, name } = added.data;
  return { passkey: { createdAt, id, name: name ?? null }, status: "added" };
}

export async function deletePasskey(id: string): Promise<PasskeyChangeFailure | "deleted"> {
  const refused = await confirmChange({ action: "delete", passkeyId: id });

  if (refused) {
    return refused;
  }

  const deleted = await client.passkey.deletePasskey({ id });
  return deleted.data ? "deleted" : toFailure(deleted.error);
}

export async function renamePasskey({
  id,
  name,
}: {
  id: string;
  name: string;
}): Promise<"failed" | "renamed"> {
  const renamed = await client.passkey.updatePasskey({ id, name });
  return renamed.data ? "renamed" : "failed";
}
