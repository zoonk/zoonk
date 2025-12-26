import { randomUUID } from "node:crypto";
import { type Course, prisma } from "@zoonk/db";

export function courseAttrs(
  attrs?: Partial<Course>,
): Omit<Course, "id" | "createdAt" | "updatedAt"> {
  return {
    description: "Test course description",
    imageUrl: "https://example.com/image.jpg",
    isPublished: false,
    language: "en",
    normalizedTitle: "test course",
    organizationId: 0,
    slug: `test-course-${randomUUID()}`,
    title: "Test Course",
    ...attrs,
  };
}

export async function courseFixture(attrs?: Partial<Course>) {
  const course = await prisma.course.create({ data: courseAttrs(attrs) });
  return course;
}
