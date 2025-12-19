import {
  LoginDescription,
  LoginDivider,
  LoginEmailInput,
  LoginEmailLabel,
  LoginField,
  LoginForm,
  LoginHeader,
  LoginSubmit,
  LoginTitle,
} from "@zoonk/ui/patterns/auth/login";
import { cacheTagLogin } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { sendVerificationOTPAction } from "./actions";
import LoginContainer from "./login-container";
import { SocialLogin } from "./social-login";

async function Login({
  params,
}: {
  params: PageProps<"/[locale]/login">["params"];
}) {
  "use cache";

  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getExtracted();

  cacheLife("max");
  cacheTag(locale, cacheTagLogin());

  return (
    <>
      <LoginHeader>
        <LoginTitle>{t("Sign in")}</LoginTitle>
        <LoginDescription>
          {t("Continue with your email or social account")}
        </LoginDescription>
      </LoginHeader>

      <SocialLogin />

      <LoginDivider>{t("Or")}</LoginDivider>

      <LoginForm action={sendVerificationOTPAction}>
        <LoginField>
          <LoginEmailLabel>{t("Email")}</LoginEmailLabel>
          <LoginEmailInput placeholder={t("me@myorg.com")} />
        </LoginField>

        <LoginSubmit>{t("Continue")}</LoginSubmit>
      </LoginForm>
    </>
  );
}

export default function LoginPage({ params }: PageProps<"/[locale]/login">) {
  return (
    <LoginContainer>
      <Suspense fallback={null}>
        <Login params={params} />
      </Suspense>
    </LoginContainer>
  );
}
