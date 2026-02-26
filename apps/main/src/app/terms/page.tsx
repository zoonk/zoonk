"use cache";

import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Read Zoonk's terms of use to understand the rules and conditions for using our platform and services",
    ),
    title: t("Terms of Use"),
  };
}

export default async function Terms({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- dynamic import returns any
  const { default: TermsOfService } = await import(`./${locale}.mdx`);

  return (
    <main className="prose dark:prose-invert max-w-full p-4">
      <TermsOfService />
    </main>
  );
}
