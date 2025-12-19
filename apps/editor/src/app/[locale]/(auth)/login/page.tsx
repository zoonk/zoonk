import { getSession } from "@zoonk/core/users";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import {
  Login,
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
import { redirect } from "@/i18n/navigation";
import { sendVerificationOTPAction } from "./actions";
import { SocialLogin } from "./social-login";

async function LoginView({
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

async function LoginPermissions({
  children,
  params,
}: {
  children: React.ReactNode;
  params: PageProps<"/[locale]/login">["params"];
}) {
  const { locale } = await params;
  const session = await getSession();

  if (session) {
    redirect({ href: "/", locale });
  }

  return children;
}

export default function LoginPage({ params }: PageProps<"/[locale]/login">) {
  return (
    <Login>
      <Suspense fallback={<FullPageLoading />}>
        <LoginPermissions params={params}>
          <LoginView params={params} />
        </LoginPermissions>
      </Suspense>
    </Login>
  );
}
