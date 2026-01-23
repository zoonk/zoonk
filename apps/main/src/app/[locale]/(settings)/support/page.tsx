"use cache";

import { getExtracted, setRequestLocale } from "next-intl/server";
import { SupportContent } from "./support-content";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/support">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Get help with your account, courses, or any technical issues. Our support team is here to assist you.",
    ),
    title: t("Help & Support"),
  };
}

export default async function Support({ params }: PageProps<"/[locale]/support">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <SupportContent />;
}
