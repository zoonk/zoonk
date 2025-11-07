"use cache";

import { cacheTagMyCourses } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/my">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagMyCourses());

  const t = await getExtracted({ locale });

  return {
    description: t(
      "View all the courses you started on Zoonk. Continue where you left off and track your progress across interactive lessons and activities.",
    ),
    title: t("My Courses"),
  };
}

export default async function MyCourses() {
  cacheLife("max");
  cacheTag(cacheTagMyCourses());
  return <main>{}</main>;
}
