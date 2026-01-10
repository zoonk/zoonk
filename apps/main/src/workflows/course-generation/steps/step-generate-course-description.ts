import { generateCourseDescription } from "@zoonk/ai/course-description/generate";

export async function stepGenerateCourseDescription(params: {
  title: string;
  locale: string;
}) {
  "use step";

  const { data } = await generateCourseDescription({
    locale: params.locale,
    title: params.title,
  });

  return { data: data.description };
}
