import {
  getOneTimeTokenCallbackPage,
  verifyOneTimeTokenCallback,
} from "@zoonk/core/auth/ott/callback";
import { type NextRequest } from "next/server";

/** Opening the sign-in link: a page that posts itself, so the link alone signs nobody in. */
export function GET(request: NextRequest) {
  return getOneTimeTokenCallbackPage({
    copy: { action: "Continue", lang: "en", restart: "Sign in again", title: "Signing you in…" },
    request,
    restartHref: "/login",
  });
}

/** The page's post redeems the token. */
export const POST = verifyOneTimeTokenCallback;
