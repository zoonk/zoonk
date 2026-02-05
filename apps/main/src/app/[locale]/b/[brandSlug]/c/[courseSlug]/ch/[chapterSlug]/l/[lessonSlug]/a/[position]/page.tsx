"use cache";

import { getActivity } from "@/data/activities/get-activity";
import { getLesson } from "@/data/lessons/get-lesson";
import { cacheTagActivity } from "@zoonk/utils/cache";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { type Metadata } from "next";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { ActivityNotGenerated } from "./activity-not-generated";

type Props =
  PageProps<"/[locale]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]/a/[position]">;

export async function generateStaticParams() {
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

  const lesson = await getLesson({ brandSlug, chapterSlug, courseSlug, lessonSlug });

  if (!lesson) {
    notFound();
  }

  const activityPosition = Number.parseInt(position, 10);

  if (Number.isNaN(activityPosition)) {
    notFound();
  }

  const activity = await getActivity({ lessonId: lesson.id, position: activityPosition });

  if (!activity) {
    notFound();
  }

  cacheTag(cacheTagActivity({ activityId: activity.id }));

  if (activity.generationStatus !== "completed") {
    return (
      <main className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center p-4">
        <ActivityNotGenerated activityId={activity.id} locale={locale} />
      </main>
    );
  }

  return (
    <main className="p-4">
      <pre className="bg-muted overflow-auto rounded-lg p-4 text-sm">
        {JSON.stringify(
          activity,
          (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value),
          2,
        )}
      </pre>
    </main>
  );
}
