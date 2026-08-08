"use client";

import { setCookie } from "@zoonk/utils/cookies";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { buildAuthLoginUrl } from "@zoonk/utils/origin";
import { useEffect } from "react";
import {
  ONE_TIME_TOKEN_LOGIN_STATE_COOKIE,
  ONE_TIME_TOKEN_LOGIN_STATE_MAX_AGE_SECONDS,
  addLoginStateToCallbackUrl,
} from "./ott-state";

const LOGIN_STATE_BYTE_LENGTH = 32;
const HEX_RADIX = 16;

/** Encodes each random byte with a fixed width so the complete state can safely travel through cookies and URLs. */
function byteToHex(byte: number): string {
  return byte.toString(HEX_RADIX).padStart(2, "0");
}

/**
 * Creates an unpredictable state value in the browser that starts the login
 * flow. `getRandomValues` remains available on insecure HTTP origins such as
 * LAN development hosts, where browsers do not expose `randomUUID`.
 */
function createLoginState(): string {
  const randomBytes = globalThis.crypto.getRandomValues(new Uint8Array(LOGIN_STATE_BYTE_LENGTH));

  return Array.from(randomBytes, byteToHex).join("");
}

/**
 * Builds the callback URL from the current browser origin so the same component
 * works on local dev, previews, production, and future custom domains.
 */
function buildCallbackUrl(callbackPath: string): string {
  return new URL(callbackPath, globalThis.location.origin).toString();
}

/**
 * Writes the state cookie synchronously before the page leaves the app origin.
 * The callback must be able to read this cookie on `/auth/callback`, so the
 * cookie is scoped to the full app path instead of the `/login` page.
 */
async function setLoginStateCookie(state: string): Promise<void> {
  await setCookie(ONE_TIME_TOKEN_LOGIN_STATE_COOKIE, state, {
    maxAge: ONE_TIME_TOKEN_LOGIN_STATE_MAX_AGE_SECONDS,
    sameSite: "lax",
  });
}

/**
 * Stores the local login state and then navigates to central auth. This must run
 * in the browser because `/login` is a normal page, while the state cookie must
 * be written before leaving the app origin.
 */
async function startOneTimeTokenLogin({
  callbackPath,
  locale,
}: {
  callbackPath: string;
  locale: SupportedLocale;
}): Promise<void> {
  const state = createLoginState();

  const callbackUrl = addLoginStateToCallbackUrl({
    callbackUrl: buildCallbackUrl(callbackPath),
    state,
  });

  await setLoginStateCookie(state);
  globalThis.location.assign(buildAuthLoginUrl({ callbackUrl, locale }));
}

/**
 * Starts the cross-domain Better Auth handoff after the login page mounts. The
 * effect synchronizes with browser APIs: it writes a cookie and performs a
 * document navigation outside the React app.
 */
export function OneTimeTokenLoginRedirect({
  callbackPath,
  locale,
}: {
  callbackPath: string;
  locale: SupportedLocale;
}) {
  useEffect(() => {
    void startOneTimeTokenLogin({ callbackPath, locale });
  }, [callbackPath, locale]);

  return null;
}
