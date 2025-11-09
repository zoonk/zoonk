"use cache";

import { cacheTagTerms } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagTerms());

  const t = await getTranslations({ locale, namespace: "Terms" });

  return {
    description: t("metaDescription"),
    title: t("metaTitle"),
  };
}

export default async function Terms({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagTerms());

  const { default: TermsOfService } = await import(`./${locale}.mdx`);

  return (
    <main className="prose dark:prose-invert max-w-full p-4">
      <TermsOfService />
    </main>
  );
}
