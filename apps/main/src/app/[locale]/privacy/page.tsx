"use cache";

import { cacheTagPrivacy } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagPrivacy());

  const t = await getExtracted({ locale });

  return {
    description: t(
      "Read Zoonk's privacy policy to understand how we collect, use, and protect your personal information.",
    ),
    title: t("Privacy Policy"),
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
