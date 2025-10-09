import type { Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/user";
import LoginPage from "./login-page";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/login">): Promise<Metadata> {
  "use cache";
  cacheLife("max");
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Login({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params;

  const session = await getSession();

  if (session) {
    return redirect({ href: "/", locale });
  }

  return <LoginPage params={params} />;
}
