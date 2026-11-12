import { startAuthentication } from "@simplewebauthn/browser";
import { safeAsync } from "@zoonk/utils/error";
import {
  type PasskeyApprovalOptions,
  type PasskeyAssertion,
  passkeyAssertionSchema,
} from "./passkey-approval-contract";

type BrowserOptions = Parameters<typeof startAuthentication>[0]["optionsJSON"];

/**
 * Asks the browser for one of the person's passkeys to sign `options`' challenge. Null when they
 * cancel, have none of the allowed passkeys on this device, or the browser has no passkeys.
 */
export async function signWithPasskey(
  options: PasskeyApprovalOptions,
): Promise<PasskeyAssertion | null> {
  const { data } = await safeAsync(() =>
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the server stores each passkey's transports as text, and the browser ignores the ones it doesn't know
    startAuthentication({ optionsJSON: options as BrowserOptions }),
  );

  const assertion = passkeyAssertionSchema.safeParse(data);
  return assertion.success ? assertion.data : null;
}
