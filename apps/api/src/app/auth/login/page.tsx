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
} from "@/components/login";
import { getSession } from "@zoonk/core/users/session/get";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { getExtracted } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { sendVerificationOTPAction } from "./actions";
import { SocialLogin } from "./social-login";

type LoginPageProps = {
  searchParams: Promise<{ redirectTo?: string }>;
};

async function LoginView({ searchParams }: LoginPageProps) {
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

      <LoginForm action={sendVerificationOTPAction}>
        <input name="redirectTo" type="hidden" value={redirectTo ? String(redirectTo) : ""} />

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
            privacy: (children) => <a href="https://zoonk.com/privacy">{children}</a>,
            terms: (children) => <a href="https://zoonk.com/terms">{children}</a>,
          },
        )}
      </LoginFooter>
    </>
  );
}

export default async function LoginPage(props: LoginPageProps) {
  return (
    <Login>
      <Suspense fallback={<FullPageLoading />}>
        <LoginView {...props} />
      </Suspense>
    </Login>
  );
}
