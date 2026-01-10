import { generateCourseImage } from "@zoonk/core/courses/image";

export async function stepGenerateCourseThumbnail(params: { title: string }) {
  "use step";

  const { data: url } = await generateCourseImage({ title: params.title });

  return { url };
}
