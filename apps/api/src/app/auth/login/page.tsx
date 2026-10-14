import { AuthFrame } from "@/components/auth-frame";
import {
  Login,
  LoginDescription,
  LoginDivider,
  LoginFooter,
  LoginHeader,
  LoginTitle,
} from "@/components/login";
import { auth } from "@zoonk/auth";
import { getSessionCookieName } from "@zoonk/auth/cookies";
import { RegisterSharedEventProperties } from "@zoonk/core/analytics/register-shared-properties";
import { buildSharedEventProperties } from "@zoonk/core/analytics/shared-properties";
import { AUTH_LOGIN_EXPIRED_ERROR } from "@zoonk/utils/origin";
import { MAIN_URL } from "@zoonk/utils/url";
import { getExtracted, getLocale } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { getCallbackHref, readRedirectTo } from "../_utils/auth-redirect";
import { getReturnAppUrl } from "../_utils/return-app";
import { EmailLoginForm } from "./email-login-form";
import { SocialLogin } from "./social-login";

/** The terms and privacy policy live on this environment's main app. */
const TERMS_URL = new URL("/terms", MAIN_URL).toString();
const PRIVACY_URL = new URL("/privacy", MAIN_URL).toString();

/**
 * Keeps the rich-text replacement stable between renders. The translation
 * parser calls this function only for the terms placeholder, so the login view
 * can pass a module-level renderer instead of creating a new component inside
 * the page render.
 */
function TermsLink(children: ReactNode) {
  return <a href={TERMS_URL}>{children}</a>;
}

/**
 * Keeps the rich-text replacement stable between renders. The translation
 * parser calls this function only for the privacy placeholder, so the login
 * view can pass a module-level renderer instead of creating a new component
 * inside the page render.
 */
function PrivacyLink(children: ReactNode) {
  return <a href={PRIVACY_URL}>{children}</a>;
}

/** Only a browser with a session cookie can be signed in already. */
async function hasSessionCookie(): Promise<boolean> {
  const store = await cookies();
  return [true, false].some((secure) => store.has(getSessionCookieName({ secure })));
}

/**
 * A browser already signed in here goes straight back to the app, without the form. Only one with a
 * session cookie waits for the session's lookup, so everyone else gets the form at once.
 */
async function redirectWhenSignedIn({
  error,
  redirectTo,
}: {
  error?: string | string[];
  redirectTo: string | null;
}) {
  if (error !== undefined || !(await hasSessionCookie())) {
    return;
  }

  // A revoked session can remain in the signed cookie cache after another app logs out.
  if (
    await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } })
  ) {
    redirect(getCallbackHref(redirectTo));
  }
}

export default async function LoginPage({ searchParams }: PageProps<"/auth/login">) {
  const params = await searchParams;
  const redirectTo = readRedirectTo(params.redirectTo);

  await redirectWhenSignedIn({ error: params.error, redirectTo });

  const t = await getExtracted();
  const locale = await getLocale();

  return (
    <AuthFrame appUrl={getReturnAppUrl(redirectTo)}>
      <RegisterSharedEventProperties
        properties={buildSharedEventProperties({ isGuest: true, locale, platform: "web" })}
      />

      <Login>
        <LoginHeader>
          <LoginTitle>{t("Sign in or create an account")}</LoginTitle>

          {params.error === AUTH_LOGIN_EXPIRED_ERROR && (
            <LoginDescription role="status">
              {t("That sign-in expired. Try again.")}
            </LoginDescription>
          )}
        </LoginHeader>

        <SocialLogin redirectTo={redirectTo} />

        <LoginDivider>{t("Or")}</LoginDivider>

        <EmailLoginForm redirectTo={redirectTo} />

        <LoginFooter>
          {t.rich(
            "By clicking on Continue, you agree to our <terms>Terms of Service</terms> and <privacy>Privacy Policy</privacy>.",
            { privacy: PrivacyLink, terms: TermsLink },
          )}
        </LoginFooter>
      </Login>
    </AuthFrame>
  );
}
