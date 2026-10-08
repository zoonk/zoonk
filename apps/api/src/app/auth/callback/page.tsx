import { trackAuthCompleted } from "@/lib/server-track-events";
import { externalRedirect } from "@zoonk/core/navigation/external-redirect";
import { getSession } from "@zoonk/core/users/session";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { MAIN_URL } from "@zoonk/utils/url";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getLoginHref, getSetupHref, readRedirectTo } from "../_utils/auth-redirect";
import { createOneTimeTokenAction, validateTrustedOriginAction } from "./actions";

/**
 * A sign-in that started on the API itself (no app asked for it) ends in the main app. Its login
 * page hands the session over the usual way: it comes back here with its own address, and this
 * session goes straight through.
 */
const MAIN_APP_LOGIN_URL = new URL("/login", MAIN_URL).toString();

/** An app's address to go back to must be one of Zoonk's. */
async function isTrustedRedirect(redirectTo: string): Promise<boolean> {
  return URL.canParse(redirectTo) && validateTrustedOriginAction(redirectTo);
}

async function CallbackHandler({
  searchParams,
}: {
  searchParams: PageProps<"/auth/callback">["searchParams"];
}) {
  /** Auth reads the clock (sessions, tokens), so the handoff only ever runs per request. */
  await connection();

  const params = await searchParams;
  const redirectTo = readRedirectTo(params.redirectTo);
  const [session, locale] = await Promise.all([getSession(), getLocale()]);

  if (!session) {
    return redirect(getLoginHref(redirectTo));
  }

  if (redirectTo && !(await isTrustedRedirect(redirectTo))) {
    return redirect("/auth/untrusted-origin");
  }

  const needsSetup = !session.user.username || !session.user.name;

  if (needsSetup) {
    await trackAuthCompleted({ action: "sign-up", locale, userId: session.user.id });
    redirect(getSetupHref(redirectTo));
  }

  if (!redirectTo) {
    return externalRedirect(MAIN_APP_LOGIN_URL);
  }

  const result = await createOneTimeTokenAction(redirectTo);

  if (!result.success) {
    return redirect("/auth/untrusted-origin");
  }

  await trackAuthCompleted({ action: "sign-in", locale, userId: session.user.id });

  return externalRedirect(result.url);
}

export default async function CallbackPage(props: PageProps<"/auth/callback">) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <CallbackHandler searchParams={props.searchParams} />
    </Suspense>
  );
}
