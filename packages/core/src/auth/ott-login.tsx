"use client";

import { setCookie } from "@zoonk/utils/cookies";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { buildAuthLoginUrl } from "@zoonk/utils/origin";
import { useEffect } from "react";
import {
  ONE_TIME_TOKEN_LOGIN_STATE_COOKIE,
  ONE_TIME_TOKEN_LOGIN_STATE_MAX_AGE_SECONDS,
  addLoginStateToCallbackUrl,
  createLoginState,
} from "./ott-state";

function buildCallbackUrl(callbackPath: string): string {
  return new URL(callbackPath, globalThis.location.origin).toString();
}

/** The callback reads this cookie outside `/login`, so it needs the full app path. */
async function setLoginStateCookie(state: string): Promise<void> {
  await setCookie(ONE_TIME_TOKEN_LOGIN_STATE_COOKIE, state, {
    maxAge: ONE_TIME_TOKEN_LOGIN_STATE_MAX_AGE_SECONDS,
    sameSite: "lax",
  });
}

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
