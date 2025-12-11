import { randomUUID } from "node:crypto";
import { type Course, prisma } from "@zoonk/db";
import { organizationFixture } from "./organizations";

export function courseAttrs(
  attrs?: Partial<Course>,
): Omit<Course, "id" | "createdAt" | "updatedAt"> {
  return {
    description: "Test course description",
    imageUrl: "https://example.com/image.jpg",
    isPublished: false,
    language: "en",
    organizationId: 0,
    slug: `test-course-${randomUUID()}`,
    title: "Test Course",
    ...attrs,
  };
}

export async function courseFixture(attrs?: Partial<Course>) {
  const org = await organizationFixture();
  const params = courseAttrs({ organizationId: org.id, ...attrs });

  const course = await prisma.course.create({
    data: params,
  });

  return { course, organization: org };
}
