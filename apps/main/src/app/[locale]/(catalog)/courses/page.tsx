"use cache";

import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/courses">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Explore all Zoonk courses to learn anything using AI. Find interactive lessons, challenges, and activities to learn subjects like science, math, technology, and more.",
    ),
    title: t("Online Courses using AI"),
  };
}

export default async function Courses() {
  return <main>{}</main>;
}
