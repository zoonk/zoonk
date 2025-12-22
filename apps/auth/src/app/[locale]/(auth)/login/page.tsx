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
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { sendVerificationOTPAction } from "./actions";
import { SocialLogin } from "./social-login";

async function LoginView({ searchParams }: PageProps<"/[locale]/login">) {
  const t = await getExtracted();
  const { redirectTo } = await searchParams;

  return (
    <>
      <LoginHeader>
        <LoginTitle>{t("Sign in or create an account")}</LoginTitle>
        <LoginDescription>
          {t("Continue with your email or a social account")}
        </LoginDescription>
      </LoginHeader>

      <SocialLogin redirectTo={redirectTo ? String(redirectTo) : undefined} />

      <LoginDivider>{t("Or")}</LoginDivider>

      <LoginForm action={sendVerificationOTPAction}>
        <input
          name="redirectTo"
          type="hidden"
          value={redirectTo ? String(redirectTo) : ""}
        />

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

export default async function LoginPage(props: PageProps<"/[locale]/login">) {
  return (
    <Login>
      <Suspense fallback={<FullPageLoading />}>
        <LoginView {...props} />
      </Suspense>
    </Login>
  );
}
