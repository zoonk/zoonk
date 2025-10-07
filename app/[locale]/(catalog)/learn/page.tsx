"use cache";

import type { Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StartCourseForm } from "./StartCourseForm";

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

export default async function Learn({ params }: PageProps<"/[locale]/learn">) {
  cacheLife("max");
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Learn" });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 p-4">
      <h1
        id="learn-title"
        className="-tracking-wide md:-tracking-wider pt-4 text-center font-semibold text-2xl text-foreground/90 md:pt-8 md:text-3xl md:tracking-tightest"
      >
        {t("title")}
      </h1>

      <StartCourseForm />
    </main>
  );
}
