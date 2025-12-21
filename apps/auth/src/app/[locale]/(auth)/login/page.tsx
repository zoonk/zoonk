import { getSession } from "@zoonk/core/users";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import {
  Login,
  LoginDescription,
  LoginDivider,
  LoginEmailInput,
  LoginEmailLabel,
  LoginField,
  LoginFooter,
  LoginForm,
  LoginHeader,
  LoginSubmit,
  LoginTitle,
} from "@zoonk/ui/patterns/auth/login";
import { sanitizeRedirectUrl } from "@zoonk/utils/auth-url";
import { cacheTagLogin } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { sendVerificationOTPAction } from "./actions";
import { SocialLogin } from "./social-login";

async function LoginView({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  "use cache";

  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getExtracted();
  const { redirectTo } = await searchParams;

  // Validate and sanitize the redirectTo parameter
  const safeRedirectTo = sanitizeRedirectUrl(
    redirectTo ? String(redirectTo) : undefined,
  );

  cacheLife("max");
  cacheTag(locale, cacheTagLogin());

  return (
    <>
      <LoginHeader>
        <LoginTitle>{t("Sign in or create an account")}</LoginTitle>
        <LoginDescription>
          {t("Continue with your email or a social account")}
        </LoginDescription>
      </LoginHeader>

      <SocialLogin redirectTo={safeRedirectTo ?? undefined} />

      <LoginDivider>{t("Or")}</LoginDivider>

      <LoginForm action={sendVerificationOTPAction}>
        <input name="redirectTo" type="hidden" value={safeRedirectTo ?? ""} />

        <LoginField>
          <LoginEmailLabel>{t("Email")}</LoginEmailLabel>
          <LoginEmailInput placeholder={t("me@myorg.com")} />
        </LoginField>

        <LoginSubmit>{t("Continue")}</LoginSubmit>
      </LoginForm>

      <LoginFooter>
        {t.rich(
          "By clicking on Continue, you agree to our <terms>Terms of Service</terms> and <privacy>Privacy Policy</privacy>.",
          {
            privacy: (children) => (
              <a href="https://zoonk.com/privacy">{children}</a>
            ),
            terms: (children) => (
              <a href="https://zoonk.com/terms">{children}</a>
            ),
          },
        )}
      </LoginFooter>
    </>
  );
}

async function LoginPermissions({
  children,
  searchParams,
}: {
  children: React.ReactNode;
  searchParams: PageProps<"/[locale]/login">["searchParams"];
}) {
  const session = await getSession();
  const { redirectTo } = await searchParams;

  // Validate the redirectTo parameter
  const safeRedirectTo = sanitizeRedirectUrl(
    redirectTo ? String(redirectTo) : undefined,
  );

  if (session && safeRedirectTo) {
    // User is already logged in, redirect back with a token
    // This will be handled by the callback action
    const { redirect } = await import("next/navigation");
    redirect(`/callback?redirectTo=${encodeURIComponent(safeRedirectTo)}`);
  }

  return children;
}

export default async function LoginPage(props: PageProps<"/[locale]/login">) {
  return (
    <Login>
      <Suspense fallback={<FullPageLoading />}>
        <LoginPermissions searchParams={props.searchParams}>
          <LoginView {...props} />
        </LoginPermissions>
      </Suspense>
    </Login>
  );
}
