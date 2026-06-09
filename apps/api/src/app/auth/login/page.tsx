import {
  Login,
  LoginDescription,
  LoginDivider,
  LoginFooter,
  LoginHeader,
  LoginTitle,
} from "@/components/login";
import { getSession } from "@zoonk/core/users/session/get";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { getExtracted } from "next-intl/server";
import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
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
  const { redirectTo } = await searchParams;

  const session = await getSession();

  if (session && redirectTo) {
    redirect(`/auth/callback?redirectTo=${encodeURIComponent(String(redirectTo))}`);
  }

  const t = await getExtracted();

  return (
    <>
      <LoginHeader>
        <LoginTitle>{t("Sign in or create an account")}</LoginTitle>
        <LoginDescription>{t("Continue with your email or a social account")}</LoginDescription>
      </LoginHeader>

      <SocialLogin redirectTo={redirectTo ? String(redirectTo) : undefined} />

      <LoginDivider>{t("Or")}</LoginDivider>

      <EmailLoginForm redirectTo={redirectTo ? String(redirectTo) : undefined} />

      <LoginFooter>
        {t.rich(
          "By clicking on Continue, you agree to our <terms>Terms of Service</terms> and <privacy>Privacy Policy</privacy>.",
          { privacy: PrivacyLink, terms: TermsLink },
        )}
      </LoginFooter>
    </>
  );
}

export default async function LoginPage(props: PageProps<"/auth/login">) {
  return (
    <Login>
      <Suspense fallback={<FullPageLoading />}>
        <LoginView {...props} />
      </Suspense>
    </Login>
  );
}
