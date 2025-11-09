"use cache";

import { cacheTagCourses } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/courses">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagCourses());

  const t = await getTranslations({ locale, namespace: "Courses" });

  return {
    description: t("metaDescription"),
    title: t("metaTitle"),
  };
}

export default async function Courses() {
  cacheLife("max");
  cacheTag(cacheTagCourses());
  return <main>{}</main>;
}
