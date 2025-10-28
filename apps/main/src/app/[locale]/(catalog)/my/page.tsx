"use cache";

import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/my">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, "my-courses");

  const t = await getTranslations({ locale, namespace: "MyCourses" });

  return {
    description: t("metaDescription"),
    title: t("metaTitle"),
  };
}

export default async function MyCourses() {
  cacheLife("max");
  cacheTag("my-courses");
  return <main>{}</main>;
}
