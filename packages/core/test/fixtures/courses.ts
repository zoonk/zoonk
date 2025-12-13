import { randomUUID } from "node:crypto";
import { type Course, prisma } from "@zoonk/db";
import { organizationFixture } from "./organizations";
import { userFixture } from "./users";

export function courseAttrs(
  attrs?: Partial<Course>,
): Omit<Course, "id" | "createdAt" | "updatedAt"> {
  return {
    authorId: 0,
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
  const org = await organizationFixture();
  const author = await userFixture();
  const params = courseAttrs({
    authorId: Number(author.id),
    organizationId: org.id,
    ...attrs,
  });

  const course = await prisma.course.create({
    data: params,
  });

  return { author, course, organization: org };
}
