import { prisma } from "@zoonk/db";

export async function getCurriculumCourseStep(courseId: string) {
  "use step";
  return prisma.course.findUniqueOrThrow({ where: { id: courseId } });
}
