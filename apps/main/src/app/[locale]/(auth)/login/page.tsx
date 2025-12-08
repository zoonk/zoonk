"use cache";

import {
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
import { cacheTagLogin } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { sendVerificationOTPAction } from "./actions";
import LoginContainer from "./login-container";
import { SocialLogin } from "./social-login";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagLogin());

  const t = await getExtracted({ locale });

  return {
    description: t(
      "Login to your account or create a new one to start using Zoonk.",
    ),
    title: t("Login or Sign Up"),
  };
}

export default async function Login({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getExtracted();

  cacheLife("max");
  cacheTag(locale, cacheTagLogin());

  return (
    <LoginContainer>
      <LoginHeader>
        <LoginTitle>{t("Sign in or create an account")}</LoginTitle>
        <LoginDescription>
          {t("Continue with your email or a social account")}
        </LoginDescription>
      </LoginHeader>

      <SocialLogin />

      <LoginDivider>{t("Or")}</LoginDivider>

      <LoginForm
        action={sendVerificationOTPAction}
        className="flex flex-col gap-6"
      >
        <LoginField>
          <LoginEmailLabel>{t("Email")}</LoginEmailLabel>
          <LoginEmailInput placeholder={t("myemail@gmail.com")} />
        </LoginField>

        <LoginSubmit>{t("Continue")}</LoginSubmit>
      </LoginForm>

      <LoginFooter>
        {t.rich(
          "By clicking on Continue, you agree to our <terms>Terms of Service</terms> and <privacy>Privacy Policy</privacy>.",
          {
            privacy: (children) => <Link href="/privacy">{children}</Link>,
            terms: (children) => <Link href="/terms">{children}</Link>,
          },
        )}
      </LoginFooter>
    </LoginContainer>
  );
}
