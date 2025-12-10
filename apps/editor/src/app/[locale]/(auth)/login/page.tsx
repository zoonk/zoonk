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
import { getExtracted, setRequestLocale } from "next-intl/server";
import { sendVerificationOTPAction } from "./actions";
import LoginContainer from "./login-container";
import { SocialLogin } from "./social-login";

export default async function Login({ params }: PageProps<"/[locale]/login">) {
  "use cache";

  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getExtracted();

  return (
    <LoginContainer>
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
    </LoginContainer>
  );
}
