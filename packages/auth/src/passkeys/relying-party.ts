import { getBaseUrl } from "@zoonk/utils/origin";
import { ADMIN_URL } from "@zoonk/utils/url";

const IPV4_ADDRESS = /^\d{1,3}(?:\.\d{1,3}){3}$/u;
const SHARED_DOMAIN_LABELS = 2;

/**
 * People add a passkey in Main and use it in Admin, so its RP ID is the domain every app shares
 * (zoonk.com, zoonk.dev, a checkout's `*.localhost`). Vercel's preview hosts share only the public
 * suffix `vercel.app`, which browsers refuse as an RP ID, so a preview's passkeys stay on one app.
 */
function toRelyingPartyId(hostname: string): string {
  if (hostname.endsWith(".vercel.app") || IPV4_ADDRESS.test(hostname)) {
    return hostname;
  }

  return hostname.split(".").slice(-SHARED_DOMAIN_LABELS).join(".");
}

const ownUrl = new URL(getBaseUrl());

export const PASSKEY_RP_ID = toRelyingPartyId(ownUrl.hostname);

/** Each app registers passkeys only from its own pages. */
export const PASSKEY_REGISTRATION_ORIGIN = ownUrl.origin;

/** Content fixes are approved only from Admin's pages. */
export const PASSKEY_APPROVAL_ORIGIN = new URL(ADMIN_URL).origin;
