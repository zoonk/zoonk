"use cache";

import { cacheTagLogin } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import LoginContainer from "./login-container";
import LoginFooter from "./login-footer";
import LoginForm from "./login-form";
import LoginHeader from "./login-header";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/login">): Promise<Metadata> {
  "use cache";

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

  cacheLife("max");
  cacheTag(locale, cacheTagLogin());

  return (
    <LoginContainer>
      <LoginHeader />
      <LoginForm />
      <LoginFooter />
    </LoginContainer>
  );
}
