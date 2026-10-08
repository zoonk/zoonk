import { AuthFrame } from "@/components/auth-frame";
import { Login, LoginDivider, LoginFooter, LoginHeader, LoginTitle } from "@/components/login";
import { RegisterSharedEventProperties } from "@zoonk/core/analytics/register-shared-properties";
import { buildSharedEventProperties } from "@zoonk/core/analytics/shared-properties";
import { getSession } from "@zoonk/core/users/session";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { getExtracted, getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { getCallbackHref, readRedirectTo } from "../_utils/auth-redirect";
import { EmailLoginForm } from "./email-login-form";
import { SocialLogin } from "./social-login";

/**
 * Keeps the rich-text replacement stable between renders. The translation
 * parser calls this function only for the terms placeholder, so the login view
 * can pass a module-level renderer instead of creating a new component inside
 * the page render.
 */
function TermsLink(children: ReactNode) {
  return <a href="https://zoonk.com/terms">{children}</a>;
}

/**
 * Keeps the rich-text replacement stable between renders. The translation
 * parser calls this function only for the privacy placeholder, so the login
 * view can pass a module-level renderer instead of creating a new component
 * inside the page render.
 */
function PrivacyLink(children: ReactNode) {
  return <a href="https://zoonk.com/privacy">{children}</a>;
}

async function LoginView({ searchParams }: PageProps<"/auth/login">) {
  const params = await searchParams;
  const redirectTo = readRedirectTo(params.redirectTo);
  const [session, locale] = await Promise.all([getSession(), getLocale()]);

  if (session) {
    redirect(getCallbackHref(redirectTo));
  }

  const t = await getExtracted();

  return (
    <AuthFrame>
      <RegisterSharedEventProperties
        properties={buildSharedEventProperties({ isGuest: true, locale, platform: "web" })}
      />

      <Login>
        <LoginHeader>
          <LoginTitle>{t("Sign in or create an account")}</LoginTitle>
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

export default async function LoginPage(props: PageProps<"/auth/login">) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <LoginView {...props} />
    </Suspense>
  );
}
