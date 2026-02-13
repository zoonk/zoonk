"use cache";

import { ActivityPlayerShell } from "@/components/activity-player/activity-player-shell";
import { getActivity } from "@/data/activities/get-activity";
import { getLessonSentences } from "@/data/activities/get-lesson-sentences";
import { getLessonWords } from "@/data/activities/get-lesson-words";
import { prepareActivityData } from "@/data/activities/prepare-activity-data";
import { getLesson } from "@/data/lessons/get-lesson";
import { getNextActivityInCourse } from "@zoonk/core/activities/next-in-course";
import { cacheTagActivity } from "@zoonk/utils/cache";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { parseNumericId } from "@zoonk/utils/string";
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

  const activityPosition = parseNumericId(position);

  if (activityPosition === null) {
    notFound();
  }

  const [activity, lessonWords, lessonSentences, nextActivity] = await Promise.all([
    getActivity({ lessonId: lesson.id, position: activityPosition }),
    getLessonWords({ lessonId: lesson.id }),
    getLessonSentences({ lessonId: lesson.id }),
    getNextActivityInCourse({
      activityPosition,
      chapterId: lesson.chapter.id,
      chapterPosition: lesson.chapter.position,
      courseId: lesson.chapter.course.id,
      lessonId: lesson.id,
      lessonPosition: lesson.position,
    }),
  ]);

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

  const serialized = prepareActivityData(activity, lessonWords, lessonSentences);
  const lessonHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`;
  const nextActivityHref = nextActivity
    ? `/b/${brandSlug}/c/${courseSlug}/ch/${nextActivity.chapterSlug}/l/${nextActivity.lessonSlug}/a/${nextActivity.activityPosition}`
    : null;

  return (
    <ActivityPlayerShell
      activity={serialized}
      lessonHref={lessonHref}
      nextActivityHref={nextActivityHref}
    />
  );
}
