"use cache";

import type { Metadata } from "next";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  cacheLife("max");
  cacheTag("privacy-page");
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Privacy" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Privacy({
  params,
}: PageProps<"/[locale]/privacy">) {
  cacheLife("max");
  cacheTag("privacy-page");
  const { locale } = await params;
  const { default: PrivacyPolicy } = await import(`./${locale}.mdx`);

  return (
    <main className="prose dark:prose-invert max-w-full p-4">
      <PrivacyPolicy />
    </main>
  );
}
