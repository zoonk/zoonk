"use cache";

import { cacheTagLogin } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
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

  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    description: t("metaDescription"),
    title: t("metaTitle"),
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
