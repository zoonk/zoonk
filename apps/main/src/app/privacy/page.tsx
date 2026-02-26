import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Read Zoonk's privacy policy to understand how we collect, use, and protect your personal information.",
    ),
    title: t("Privacy Policy"),
  };
}

export default async function Privacy() {
  const locale = await getLocale();
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- dynamic import returns any
  const { default: PrivacyPolicy } = await import(`./${locale}.mdx`);

  return (
    <main className="prose dark:prose-invert max-w-full p-4">
      <PrivacyPolicy />
    </main>
  );
}
