import { generateCourseDescription } from "@zoonk/ai/course-description/generate";

import { streamStatus } from "../stream-status";

type Input = { title: string; locale: string };

export async function generateDescriptionStep(input: Input): Promise<string> {
  "use step";

  await streamStatus({ status: "started", step: "generateDescription" });

  const { data } = await generateCourseDescription({
    locale: input.locale,
    title: input.title,
  });

  await streamStatus({ status: "completed", step: "generateDescription" });

  return data.description;
}
