"use cache";

import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Zoonk is an AI-powered learning platform where you can learn anything through interactive courses, lessons, and activities.",
    ),
    title: { absolute: t("Zoonk: AI Learning Platform") },
  };
}

export default async function Home() {
  return <main>{}</main>;
}
