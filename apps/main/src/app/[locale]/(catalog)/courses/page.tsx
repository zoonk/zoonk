"use cache";

import { cacheTagCourses } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/courses">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagCourses());

  const t = await getExtracted({ locale });

  return {
    description: t(
      "Explore all Zoonk courses to learn anything using AI. Find interactive lessons, challenges, and activities to learn subjects like science, math, technology, and more.",
    ),
    title: t("Online Courses using AI"),
  };
}

export default async function Courses() {
  cacheLife("max");
  cacheTag(cacheTagCourses());
  return <main>{}</main>;
}
