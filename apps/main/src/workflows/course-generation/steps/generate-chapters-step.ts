import { generateCourseChapters } from "@zoonk/ai/course-chapters/generate";

type Chapter = { title: string; description: string };
type Input = { courseTitle: string; locale: string };

export async function generateChaptersStep(input: Input): Promise<Chapter[]> {
  "use step";

  const { data } = await generateCourseChapters({
    courseTitle: input.courseTitle,
    locale: input.locale,
  });

  return data.chapters;
}
