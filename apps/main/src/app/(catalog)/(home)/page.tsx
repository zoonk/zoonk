import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { HomeContent, HomeContentSkeleton } from "./home-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Zoonk is an AI-powered learning platform where you can learn anything through interactive courses, lessons, and activities.",
    ),
    title: { absolute: t("Zoonk: AI Learning Platform") },
  };
}

export default function Home() {
  return (
    <Suspense fallback={<HomeContentSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
