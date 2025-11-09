"use cache";

import { cacheTagLearn } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StartCourseForm } from "./start-course-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/learn">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagLearn());

  const t = await getTranslations({ locale, namespace: "Learn" });

  return {
    description: t("metaDescription"),
    title: t("metaTitle"),
  };
}

export default async function Learn({ params }: PageProps<"/[locale]/learn">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagLearn());

  const t = await getTranslations({ locale, namespace: "Learn" });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 p-4">
      <h1
        className="-tracking-wide md:-tracking-wider pt-4 text-center font-semibold text-2xl text-foreground/90 md:pt-8 md:text-3xl md:tracking-tightest"
        id="learn-title"
      >
        {t("title")}
      </h1>

      <StartCourseForm />
    </main>
  );
}
