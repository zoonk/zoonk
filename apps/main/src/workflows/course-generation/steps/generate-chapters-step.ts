import { generateCourseChapters } from "@zoonk/ai/course-chapters/generate";

import { streamStatus } from "../stream-status";

type Chapter = { title: string; description: string };
type Input = { courseTitle: string; locale: string };

export async function generateChaptersStep(input: Input): Promise<Chapter[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateChapters" });

  const { data } = await generateCourseChapters({
    courseTitle: input.courseTitle,
    locale: input.locale,
  });

  await streamStatus({
    data: { chapterCount: data.chapters.length },
    status: "completed",
    step: "generateChapters",
  });

  return data.chapters;
}
