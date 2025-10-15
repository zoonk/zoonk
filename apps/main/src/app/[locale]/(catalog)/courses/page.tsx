"use cache";

import type { Metadata } from "next";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/courses">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, "courses");

  const t = await getTranslations({ locale, namespace: "Courses" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Courses() {
  cacheLife("max");
  cacheTag("courses");
  return <main>{}</main>;
}
