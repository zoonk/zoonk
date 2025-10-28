"use cache";

import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, "home");

  const t = await getTranslations({ locale, namespace: "Home" });

  return {
    description: t("metaDescription"),
    title: { absolute: t("metaTitle") },
  };
}

export default async function Home() {
  cacheLife("max");
  cacheTag("home");
  return <main>{}</main>;
}
