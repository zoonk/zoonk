import { findExistingCourse } from "@/data/courses/find-existing-course";

type Input = { title: string; locale: string };
type Output = { id: number; slug: string; generationStatus: string } | null;

export async function checkCourseExistsStep(input: Input): Promise<Output> {
  "use step";

  return findExistingCourse({
    locale: input.locale,
    title: input.title,
  });
}
