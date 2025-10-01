"use cache";

import type { Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/learn">): Promise<Metadata> {
  cacheLife("max");
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Learn" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Learn() {
  cacheLife("max");
  return <main>{}</main>;
}
