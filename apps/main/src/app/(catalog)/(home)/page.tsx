import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { HomeContent, HomeContentSkeleton } from "./home-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    alternates: { canonical: "/" },
    description: t(
      "Zoonk is an AI learning platform and study app to create courses about any topic using AI. Study for your exams or learn new skills.",
    ),
    title: { absolute: t("Zoonk: Study App with AI") },
  };
}

export default function Home() {
  return (
    <Suspense fallback={<HomeContentSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
