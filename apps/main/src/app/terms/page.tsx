import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Read Zoonk's terms of use to understand the rules and conditions for using our platform and services",
    ),
    title: t("Terms of Use"),
  };
}

export default async function Terms() {
  const locale = await getLocale();
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- dynamic import returns any
  const { default: TermsOfService } = await import(`./${locale}.mdx`);

  return (
    <main className="prose dark:prose-invert max-w-full p-4">
      <TermsOfService />
    </main>
  );
}
