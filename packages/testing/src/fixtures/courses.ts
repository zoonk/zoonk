import { randomUUID } from "node:crypto";
import {
  type Course,
  type CourseCategory,
  type CourseMode,
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
  "createdAt" | "generationStatus" | "landingPage" | "mode" | "updatedAt"
> & {
  createdAt?: Date | string;
  generationStatus?: GenerationStatus;
  landingPage?: CourseFixtureLandingPage;
  mode?: CourseMode;
  updatedAt?: Date | string;
};

function courseAttrs(attrs?: CourseFixtureAttrs) {
  const { description, ...rest } = attrs ?? {};

  return {
    completedAt: null,
    description: description ?? "Test course description",
    generationRunId: null,
    generationStatus: "completed" as const,
    imageUrl: null,
    isPublished: false,
    language: "en",
    mode: "full" as const,
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
