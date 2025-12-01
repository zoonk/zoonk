"use cache";

import { cacheTagHome } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { UserAvatarMenu } from "@/components/user-avatar-menu";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagHome());

  const t = await getExtracted({ locale });

  return {
    description: t(
      "Zoonk is an AI-powered learning platform where you can learn anything through interactive courses, lessons, and activities.",
    ),
    title: { absolute: t("Zoonk: AI Learning Platform") },
  };
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;

  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagHome());

  return (
    <div>
      <header className="flex justify-end p-4">
        <UserAvatarMenu />
      </header>
    </div>
  );
}
