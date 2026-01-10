import { generateCourseChapters } from "@zoonk/ai/course-chapters/generate";

export async function stepGenerateCourseChapters(params: {
  courseTitle: string;
  locale: string;
}) {
  "use step";

  const { data } = await generateCourseChapters({
    courseTitle: params.courseTitle,
    locale: params.locale,
  });

  return { data: data.chapters };
}
