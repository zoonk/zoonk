import { randomUUID } from "node:crypto";
import {
  type Course,
  type CourseCategory,
  type CourseFormat,
  type CourseUser,
  type GenerationStatus,
  prisma,
} from "@zoonk/db";

type CourseFixtureLandingPage = {
  audience: string[];
  opportunities: string[];
  outcomes: string[];
  valueProposition: string;
};

type CourseFixtureAttrs = Omit<
  Partial<Course>,
  "createdAt" | "format" | "generationStatus" | "landingPage" | "updatedAt"
> & {
  createdAt?: Date | string;
  format?: CourseFormat;
  generationStatus?: GenerationStatus;
  landingPage?: CourseFixtureLandingPage;
  updatedAt?: Date | string;
};

function courseAttrs(attrs?: CourseFixtureAttrs) {
  const { description, ...rest } = attrs ?? {};

  return {
    completedAt: null,
    description: description ?? "Test course description",
    format: "core" as const,
    generationRunId: null,
    generationStatus: "completed" as const,
    imageUrl: null,
    isPublished: false,
    language: "en",
    normalizedTitle: "test course",
    organizationId: null,
    slug: `test-course-${randomUUID()}`,
    targetLanguage: null,
    title: "Test Course",
    userCount: 0,
    userId: null,
    ...rest,
  };
}

export async function courseFixture(attrs?: CourseFixtureAttrs) {
  const course = await prisma.course.create({ data: courseAttrs(attrs) });
  return course;
}

export async function courseCategoryFixture(attrs: Omit<CourseCategory, "id" | "createdAt">) {
  const courseCategory = await prisma.courseCategory.create({
    data: { category: attrs.category, courseId: attrs.courseId },
  });

  return courseCategory;
}

export async function courseUserFixture(attrs: Omit<CourseUser, "id" | "startedAt">) {
  const [courseUser] = await prisma.$transaction([
    prisma.courseUser.create({ data: { courseId: attrs.courseId, userId: attrs.userId } }),
    prisma.course.update({ data: { userCount: { increment: 1 } }, where: { id: attrs.courseId } }),
  ]);

  return courseUser;
}
