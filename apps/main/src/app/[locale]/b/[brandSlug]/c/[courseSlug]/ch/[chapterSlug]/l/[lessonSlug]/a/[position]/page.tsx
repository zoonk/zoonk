import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { type Metadata } from "next";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ActivityContent, ActivityContentSkeleton } from "./activity-content";

type Props =
  PageProps<"/[locale]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]/a/[position]">;

export function generateStaticParams() {
  return [
    {
      brandSlug: AI_ORG_SLUG,
      chapterSlug: "sample",
      courseSlug: "sample",
      lessonSlug: "sample",
      locale: "en",
      position: "0",
    },
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t("Complete this activity to reinforce your learning and track your progress."),
    title: t("Activity"),
  };
}

export default async function ActivityPage({ params }: Props) {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug, locale, position } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center p-4">
      <Suspense fallback={<ActivityContentSkeleton />}>
        <ActivityContent
          brandSlug={brandSlug}
          chapterSlug={chapterSlug}
          courseSlug={courseSlug}
          lessonSlug={lessonSlug}
          locale={locale}
          position={position}
        />
      </Suspense>
    </main>
  );
}
