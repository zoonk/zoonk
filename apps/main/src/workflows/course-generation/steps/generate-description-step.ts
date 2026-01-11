import { generateCourseDescription } from "@zoonk/ai/course-description/generate";

type Input = { title: string; locale: string };

export async function generateDescriptionStep(input: Input): Promise<string> {
  "use step";

  const { data } = await generateCourseDescription({
    locale: input.locale,
    title: input.title,
  });

  return data.description;
}
