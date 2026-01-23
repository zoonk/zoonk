"use cache";

import { getExtracted } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Read Zoonk's privacy policy to understand how we collect, use, and protect your personal information.",
    ),
    title: t("Privacy Policy"),
  };
}

export default async function Privacy({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  const { default: PrivacyPolicy } = await import(`./${locale}.mdx`);

  return (
    <main className="prose dark:prose-invert max-w-full p-4">
      <PrivacyPolicy />
    </main>
  );
}
