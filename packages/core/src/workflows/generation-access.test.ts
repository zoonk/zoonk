import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import { getChapterGenerationAccess } from "./chapter-generation-access";
import { getLessonGenerationAccess } from "./lesson-generation-access";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe("generation access", () => {
  let organizationId: string;
  let courseId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    organizationId = organization.id;
    courseId = course.id;
  });

  beforeEach(() => vi.mocked(getSession).mockResolvedValue(null));

  it("allows guests to generate the free first chapter", async () => {
    const chapter = await chapterFixture({ courseId, organizationId, position: 0 });

    const result = await getChapterGenerationAccess(chapter.id);

    expect(result).toMatchObject({ chapter: { id: chapter.id }, status: "ready" });
  });

  it("requires a subscription for later chapters", async () => {
    const chapter = await chapterFixture({ courseId, organizationId, position: 1 });

    await expect(getChapterGenerationAccess(chapter.id)).resolves.toMatchObject({
      chapter: { id: chapter.id },
      status: "subscriptionRequired",
    });
  });

  it("allows subscribed learners to generate later lessons", async () => {
    const [chapter, user] = await Promise.all([
      chapterFixture({ courseId, organizationId, position: 2 }),
      userFixture(),
    ]);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "explanation",
      organizationId,
    });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    const result = await getLessonGenerationAccess(lesson.id);

    expect(result).toMatchObject({ lesson: { id: lesson.id }, status: "ready" });
  });

  it("requires a subscription for later lessons when the learner is not subscribed", async () => {
    const chapter = await chapterFixture({ courseId, organizationId, position: 3 });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "explanation",
      organizationId,
    });

    await expect(getLessonGenerationAccess(lesson.id)).resolves.toStrictEqual({
      status: "subscriptionRequired",
    });
  });

  it("hides non-standalone and non-AI resources", async () => {
    const chapter = await chapterFixture({ courseId, organizationId, position: 4 });

    const companionLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "translation",
      organizationId,
    });

    const otherOrganization = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrganization.id });

    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      organizationId: otherOrganization.id,
    });

    const [companionAccess, otherChapterAccess] = await Promise.all([
      getLessonGenerationAccess(companionLesson.id),
      getChapterGenerationAccess(otherChapter.id),
    ]);

    expect(companionAccess).toStrictEqual({ status: "notFound" });
    expect(otherChapterAccess).toStrictEqual({ status: "notFound" });
  });
});
