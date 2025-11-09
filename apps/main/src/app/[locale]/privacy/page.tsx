"use cache";

import { cacheTagPrivacy } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagPrivacy());

  const t = await getTranslations({ locale, namespace: "Privacy" });

  return {
    description: t("metaDescription"),
    title: t("metaTitle"),
  };
}

export default async function Privacy({
  params,
}: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagPrivacy());

  const { default: PrivacyPolicy } = await import(`./${locale}.mdx`);

  return (
    <main className="prose dark:prose-invert max-w-full p-4">
      <PrivacyPolicy />
    </main>
  );
}
