import { API_URL } from "@zoonk/utils/constants";
import { getString, isJsonObject } from "@zoonk/utils/json";

function buildQueryString(props: { chapterId?: number; courseId?: number; lessonId?: number }) {
  if (props.courseId) {
    return `courseId=${props.courseId}`;
  }

  if (props.chapterId) {
    return `chapterId=${props.chapterId}`;
  }

  if (props.lessonId) {
    return `lessonId=${props.lessonId}`;
  }

  return "";
}

export function buildNextActivityKey(props: {
  chapterId?: number;
  courseId?: number;
  lessonId?: number;
}) {
  return `${API_URL}/v1/progress/next-activity?${buildQueryString(props)}`;
}

export function buildCourseCompletionKey(courseId: number) {
  return `${API_URL}/v1/progress/course-completion?courseId=${courseId}`;
}

export function buildChapterCompletionKey(chapterId: number) {
  return `${API_URL}/v1/progress/chapter-completion?chapterId=${chapterId}`;
}

export function buildActivityCompletionKey(lessonId: number) {
  return `${API_URL}/v1/progress/activity-completion?lessonId=${lessonId}`;
}

export async function fetchNextActivity(url: string): Promise<{
  activityPosition: number;
  brandSlug: string;
  chapterSlug: string;
  completed: boolean;
  courseSlug: string;
  hasStarted: boolean;
  lessonSlug: string;
} | null> {
  const res = await fetch(url, { credentials: "include" });
  const json: unknown = await res.json();

  if (!isJsonObject(json)) {
    return null;
  }

  const brandSlug = getString(json, "brandSlug");

  if (!brandSlug) {
    return null;
  }

  return {
    activityPosition: Number(json.activityPosition),
    brandSlug,
    chapterSlug: getString(json, "chapterSlug") ?? "",
    completed: json.completed === true,
    courseSlug: getString(json, "courseSlug") ?? "",
    hasStarted: json.hasStarted === true,
    lessonSlug: getString(json, "lessonSlug") ?? "",
  };
}

type ChapterCompletionData = {
  chapterId: number;
  completedLessons: number;
  totalLessons: number;
};

export async function fetchCourseCompletion(url: string): Promise<ChapterCompletionData[]> {
  const res = await fetch(url, { credentials: "include" });
  const json: unknown = await res.json();

  if (!isJsonObject(json) || !Array.isArray(json.chapters)) {
    return [];
  }

  return json.chapters.filter(
    (item): item is ChapterCompletionData =>
      isJsonObject(item) &&
      typeof item.chapterId === "number" &&
      typeof item.completedLessons === "number" &&
      typeof item.totalLessons === "number",
  );
}

type LessonCompletionData = {
  completedActivities: number;
  lessonId: number;
  totalActivities: number;
};

export async function fetchChapterCompletion(url: string): Promise<LessonCompletionData[]> {
  const res = await fetch(url, { credentials: "include" });
  const json: unknown = await res.json();

  if (!isJsonObject(json) || !Array.isArray(json.lessons)) {
    return [];
  }

  return json.lessons.filter(
    (lesson): lesson is LessonCompletionData =>
      isJsonObject(lesson) &&
      typeof lesson.lessonId === "number" &&
      typeof lesson.completedActivities === "number" &&
      typeof lesson.totalActivities === "number",
  );
}

export async function fetchCompletedActivities(url: string): Promise<string[]> {
  const res = await fetch(url, { credentials: "include" });
  const json: unknown = await res.json();

  if (!isJsonObject(json) || !Array.isArray(json.completedActivityIds)) {
    return [];
  }

  return json.completedActivityIds.filter((id): id is string => typeof id === "string");
}
