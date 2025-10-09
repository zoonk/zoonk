"use cache";

import type { Metadata } from "next";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/terms">): Promise<Metadata> {
  cacheLife("max");
  cacheTag("terms-page");
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Terms" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Terms({ params }: PageProps<"/[locale]/terms">) {
  cacheLife("max");
  cacheTag("terms-page");
  const { locale } = await params;
  const { default: TermsOfService } = await import(`./${locale}.mdx`);

  return (
    <main className="prose dark:prose-invert max-w-full p-4">
      <TermsOfService />
    </main>
  );
}
