import { startAuthentication } from "@simplewebauthn/browser";
import { safeAsync } from "@zoonk/utils/error";
import {
  type PasskeyApprovalOptions,
  type PasskeyAssertion,
  passkeyAssertionSchema,
} from "./passkey-approval-contract";

/**
 * Asks the browser for one of the person's passkeys to sign `options`' challenge. Null when they
 * cancel, have none of the allowed passkeys on this device, or the browser has no passkeys.
 */
export async function signWithPasskey(
  options: PasskeyApprovalOptions,
): Promise<PasskeyAssertion | null> {
  const { data } = await safeAsync(() => startAuthentication({ optionsJSON: options }));

  const assertion = passkeyAssertionSchema.safeParse(data);
  return assertion.success ? assertion.data : null;
}
