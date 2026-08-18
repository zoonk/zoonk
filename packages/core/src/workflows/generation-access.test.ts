import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import { getChapterGenerationAccess, getChapterGenerationView } from "./chapter-generation-access";
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

  it("requires authentication before generating the first chapter", async () => {
    const chapter = await chapterFixture({
      courseId,
      generationStatus: "pending",
      organizationId,
      position: 0,
    });

    await expect(getChapterGenerationAccess(chapter.id)).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("requires authentication before checking later-chapter subscriptions", async () => {
    const chapter = await chapterFixture({ courseId, organizationId, position: 1 });

    await expect(getChapterGenerationAccess(chapter.id)).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("lets guests continue from a completed first chapter to its public page", async () => {
    const completedCourse = await courseFixture({ organizationId });

    const chapter = await chapterFixture({
      courseId: completedCourse.id,
      generationStatus: "completed",
      organizationId,
      position: 0,
    });

    await lessonFixture({ chapterId: chapter.id, organizationId });

    await expect(getChapterGenerationView(chapter.id)).resolves.toMatchObject({
      chapter: { id: chapter.id },
      status: "ready",
    });
  });

  it("returns chapter slugs when the generation view requires authentication", async () => {
    const course = await courseFixture({ organizationId });

    const chapter = await chapterFixture({
      courseId: course.id,
      generationStatus: "pending",
      organizationId,
      position: 0,
    });

    await expect(getChapterGenerationView(chapter.id)).resolves.toStrictEqual({
      chapterSlug: chapter.slug,
      courseSlug: course.slug,
      status: "unauthorized",
    });
  });

  it("returns not found for missing chapter views before asking guests to log in", async () => {
    await expect(getChapterGenerationView("999999999")).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("allows subscribed learners to generate later lessons", async () => {
    const [chapter, user] = await Promise.all([
      chapterFixture({ courseId, organizationId, position: 2 }),
      userFixture(),
    ]);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      kind: "explanation",
      organizationId,
    });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    const result = await getLessonGenerationAccess(lesson.id);

    expect(result).toMatchObject({
      lesson: { id: lesson.id },
      shouldClaimQuota: true,
      status: "ready",
    });
  });

  it("does not claim quota for chapter and lesson no-op repairs", async () => {
    const [repairCourse, user] = await Promise.all([
      courseFixture({ organizationId }),
      userFixture(),
    ]);

    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    const chapter = await chapterFixture({
      courseId: repairCourse.id,
      generationStatus: "pending",
      organizationId,
      position: 0,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      kind: "explanation",
      organizationId,
    });

    const [chapterAccess, lessonAccess] = await Promise.all([
      getChapterGenerationAccess(chapter.id),
      getLessonGenerationAccess(lesson.id),
    ]);

    expect(chapterAccess).toMatchObject({ shouldClaimQuota: false, status: "ready" });
    expect(lessonAccess).toMatchObject({ shouldClaimQuota: false, status: "ready" });
  });

  it("requires a subscription for later lessons when the learner is not subscribed", async () => {
    const [chapter, user] = await Promise.all([
      chapterFixture({ courseId, organizationId, position: 3 }),
      userFixture(),
    ]);

    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "explanation",
      organizationId,
    });

    await expect(getLessonGenerationAccess(lesson.id)).resolves.toStrictEqual({
      status: "subscriptionRequired",
    });
  });

  it("lets admins retry failed later lessons without claiming learner quota", async () => {
    const [chapter, admin] = await Promise.all([
      chapterFixture({ courseId, organizationId, position: 5 }),
      userFixture({ role: "admin" }),
    ]);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "failed",
      kind: "explanation",
      organizationId,
    });

    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user: admin });

    await expect(getLessonGenerationAccess(lesson.id)).resolves.toMatchObject({
      lesson: { id: lesson.id },
      shouldClaimQuota: false,
      status: "ready",
    });
  });

  it("hides non-standalone and non-AI resources", async () => {
    const [chapter, user] = await Promise.all([
      chapterFixture({ courseId, organizationId, position: 4 }),
      userFixture(),
    ]);

    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

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
