"use cache";

import type { Metadata } from "next";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/my">): Promise<Metadata> {
  cacheLife("max");
  cacheTag("my-courses-page");
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "MyCourses" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function MyCourses() {
  cacheLife("max");
  cacheTag("my-courses-page");
  return <main>{}</main>;
}
