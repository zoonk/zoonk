import { generateCourseImage } from "@zoonk/core/courses/image";

import { streamStatus } from "../stream-status";

type Input = { title: string };

export async function generateImageStep(input: Input): Promise<string | null> {
  "use step";

  await streamStatus({ status: "started", step: "generateImage" });

  const { data, error } = await generateCourseImage({ title: input.title });

  if (error) {
    console.error("Failed to generate course image:", error);
  }

  await streamStatus({ status: "completed", step: "generateImage" });

  return error ? null : data;
}
