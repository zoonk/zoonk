import { getActivity } from "@/data/activities/get-activity";
import { getLessonSentences } from "@/data/activities/get-lesson-sentences";
import { getLessonWords } from "@/data/activities/get-lesson-words";
import { getLesson } from "@/data/lessons/get-lesson";
import { getActivitySeoMeta } from "@/lib/activities";
import { getNextActivityInCourse } from "@zoonk/core/activities/next-in-course";
import { getSession } from "@zoonk/core/users/session/get";
import { prepareActivityData } from "@zoonk/player/prepare-activity-data";
import { parseNumericId } from "@zoonk/utils/string";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivityNotGenerated } from "./activity-not-generated";
import { ActivityPlayerClient } from "./activity-player-client";

type Props =
  PageProps<"/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]/a/[position]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug, position } = await params;
  const lesson = await getLesson({ brandSlug, chapterSlug, courseSlug, lessonSlug });

  if (!lesson) {
    return {};
  }

  const activityPosition = parseNumericId(position);

  if (activityPosition === null) {
    return {};
  }

  const activity = await getActivity({ lessonId: lesson.id, position: activityPosition });

  if (!activity) {
    return {};
  }

  return getActivitySeoMeta(activity, lesson.title);
}

export default async function ActivityPage({ params }: Props) {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug, position } = await params;

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

  if (activity.generationStatus !== "completed") {
    return (
      <main className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center p-4">
        <ActivityNotGenerated activityId={activity.id} />
      </main>
    );
  }

  const serialized = prepareActivityData(activity, lessonWords, lessonSentences);
  const session = await getSession();

  return (
    <ActivityPlayerClient
      activity={serialized}
      brandSlug={brandSlug}
      courseSlug={courseSlug}
      chapterSlug={chapterSlug}
      isAuthenticated={Boolean(session)}
      lessonSlug={lessonSlug}
      nextActivity={nextActivity}
      userName={session?.user.name ?? null}
    />
  );
}
