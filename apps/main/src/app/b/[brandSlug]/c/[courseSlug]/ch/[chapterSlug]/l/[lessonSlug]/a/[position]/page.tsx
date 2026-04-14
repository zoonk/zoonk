import { getLesson } from "@/data/lessons/get-lesson";
import { getActivitySeoMeta } from "@/lib/activities";
import { getNextActivityInCourse } from "@zoonk/core/activities/next-in-course";
import { startActivity } from "@zoonk/core/player/commands/start-activity";
import { prepareLessonActivityData } from "@zoonk/core/player/contracts/prepare-activity-data";
import { getActivity } from "@zoonk/core/player/queries/get-activity";
import { getActivityDistractorWords } from "@zoonk/core/player/queries/get-activity-distractor-words";
import { getLessonSentences } from "@zoonk/core/player/queries/get-lesson-sentences";
import { getLessonWords } from "@zoonk/core/player/queries/get-lesson-words";
import { getSentenceWords } from "@zoonk/core/player/queries/get-sentence-words";
import { getTotalBrainPower } from "@zoonk/core/player/queries/get-total-brain-power";
import { getSession } from "@zoonk/core/users/session/get";
import { parseNumericId } from "@zoonk/utils/number";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { fetchNextSibling, fetchReviewSteps } from "./activity-data-loaders";
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

  const [
    activity,
    distractorWords,
    lessonWords,
    lessonSentences,
    sentenceWords,
    nextActivity,
    session,
    reviewSteps,
    nextSibling,
    totalBrainPower,
  ] = await Promise.all([
    getActivity({ lessonId: lesson.id, position: activityPosition }),
    getActivityDistractorWords({ lessonId: lesson.id }),
    getLessonWords({ lessonId: lesson.id }),
    getLessonSentences({ lessonId: lesson.id }),
    getSentenceWords({ lessonId: lesson.id }),
    getNextActivityInCourse({
      activityPosition,
      chapterId: lesson.chapter.id,
      chapterPosition: lesson.chapter.position,
      courseId: lesson.chapter.course.id,
      lessonId: lesson.id,
      lessonPosition: lesson.position,
    }),
    getSession(),
    fetchReviewSteps(lesson.id, activityPosition),
    fetchNextSibling(lesson.id, activityPosition, lessonSlug, lesson.chapter, lesson.position),
    getTotalBrainPower(),
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

  const serialized = prepareLessonActivityData({
    activity,
    distractorWords,
    lessonSentences,
    lessonWords,
    sentenceWords,
    steps: reviewSteps ?? activity.steps,
  });

  if (session) {
    after(() => startActivity({ activityId: activity.id, userId: Number(session.user.id) }));
  }

  return (
    <ActivityPlayerClient
      activity={serialized}
      brandSlug={brandSlug}
      chapterTitle={lesson.chapter.title}
      courseSlug={courseSlug}
      chapterSlug={chapterSlug}
      isAuthenticated={Boolean(session)}
      lessonDescription={lesson.description}
      lessonSlug={lessonSlug}
      lessonTitle={lesson.title}
      nextActivity={nextActivity}
      nextSibling={nextSibling}
      totalBrainPower={totalBrainPower}
      userEmail={session?.user.email}
      userName={session?.user.name ?? null}
    />
  );
}
