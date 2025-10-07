"use cache";

import type { Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  cacheLife("max");
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });

  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
  };
}

export default async function Home() {
  cacheLife("max");
  return <main>{}</main>;
}
