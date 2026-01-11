import { generateCourseImage } from "@zoonk/core/courses/image";

type Input = { title: string };

export async function generateImageStep(input: Input): Promise<string | null> {
  "use step";

  const { data, error } = await generateCourseImage({ title: input.title });

  if (error) {
    console.error("Failed to generate course image:", error);
    return null;
  }

  return data;
}
