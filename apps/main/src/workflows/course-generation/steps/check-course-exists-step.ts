import { findExistingCourse } from "@/data/courses/find-existing-course";

import { streamStatus } from "../stream-status";

type Input = { title: string; locale: string };
type Output = { id: number; slug: string; generationStatus: string } | null;

export async function checkCourseExistsStep(input: Input): Promise<Output> {
  "use step";

  await streamStatus({ status: "started", step: "checkCourseExists" });

  const result = await findExistingCourse({
    locale: input.locale,
    title: input.title,
  });

  await streamStatus({ status: "completed", step: "checkCourseExists" });

  return result;
}
