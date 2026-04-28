import { randomUUID } from "node:crypto";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, test } from "vitest";
import { getLesson } from "./get-lesson";

describe(getLesson, () => {
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;
  let step1: Awaited<ReturnType<typeof stepFixture>>;
  let step2: Awaited<ReturnType<typeof stepFixture>>;

  beforeAll(async () => {
    org = await organizationFixture({ kind: "brand" });

    course = await courseFixture({
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    lesson = await lessonFixture({
      chapterId: chapter.id,
      description: "Test lesson description",
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      language: "en",
      organizationId: org.id,
      position: 0,
      title: "Test Lesson",
    });

    [step1, step2] = await Promise.all([
      stepFixture({
        content: { text: "Step 1 content", title: "Step 1" },
        isPublished: true,
        lessonId: lesson.id,
        position: 0,
      }),
      stepFixture({
        content: { text: "Step 2 content", title: "Step 2" },
        isPublished: true,
        lessonId: lesson.id,
        position: 1,
      }),
    ]);
  });

  test("returns lesson with steps", async () => {
    const result = await getLesson({ lessonId: lesson.id });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(lesson.id);
    expect(result?.title).toBe("Test Lesson");
    expect(result?.description).toBe("Test lesson description");
    expect(result?.kind).toBe("explanation");
    expect(result?.steps).toHaveLength(2);
  });

  test("orders steps by position ascending", async () => {
    const result = await getLesson({ lessonId: lesson.id });

    expect(result?.steps[0]?.id).toBe(step1.id);
    expect(result?.steps[0]?.position).toBe(0);
    expect(result?.steps[1]?.id).toBe(step2.id);
    expect(result?.steps[1]?.position).toBe(1);
  });

  test("returns generation status", async () => {
    const result = await getLesson({ lessonId: lesson.id });

    expect(result?.generationStatus).toBe("completed");
  });

  test("returns null for unpublished lesson", async () => {
    const draftLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      kind: "explanation",
      language: "en",
      organizationId: org.id,
      position: 1,
    });

    const result = await getLesson({ lessonId: draftLesson.id });

    expect(result).toBeNull();
  });

  test("returns null for non-existent lesson", async () => {
    const result = await getLesson({ lessonId: randomUUID() });

    expect(result).toBeNull();
  });

  test("includes step content and visual information", async () => {
    const result = await getLesson({ lessonId: lesson.id });

    expect(result?.steps[0]?.content).toEqual({ text: "Step 1 content", title: "Step 1" });
    expect(result?.steps[0]?.kind).toBe("static");
  });

  test("returns language and organizationId on the lesson", async () => {
    const result = await getLesson({ lessonId: lesson.id });

    expect(result?.language).toBe("en");
    expect(result?.organizationId).toBe(org.id);
  });

  test("returns word data when step has word relation", async () => {
    const [wordLesson, word] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        language: "en",
        organizationId: org.id,
        position: 0,
      }),
      wordFixture({
        audioUrl: "https://example.com/audio.mp3",
        organizationId: org.id,
        romanization: "test-roman",
        word: `test-word-${crypto.randomUUID()}`,
      }),
    ]);

    await stepFixture({
      isPublished: true,
      lessonId: wordLesson.id,
      position: 0,
      wordId: word.id,
    });

    const result = await getLesson({ lessonId: wordLesson.id });

    expect(result?.steps[0]?.word).toMatchObject({
      audioUrl: "https://example.com/audio.mp3",
      id: word.id,
      romanization: "test-roman",
      word: word.word,
    });
  });

  test("returns sentence data when step has sentence relation", async () => {
    const [sentLesson, sentence] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        language: "en",
        organizationId: org.id,
        position: 0,
      }),
      sentenceFixture({
        audioUrl: "https://example.com/sent-audio.mp3",
        organizationId: org.id,
        romanization: "test-sent-roman",
        sentence: `test-sentence-${crypto.randomUUID()}`,
      }),
    ]);

    await stepFixture({
      isPublished: true,
      lessonId: sentLesson.id,
      position: 0,
      sentenceId: sentence.id,
    });

    const result = await getLesson({ lessonId: sentLesson.id });

    expect(result?.steps[0]?.sentence).toMatchObject({
      audioUrl: "https://example.com/sent-audio.mp3",
      id: sentence.id,
      romanization: "test-sent-roman",
      sentence: sentence.sentence,
    });
  });

  test("returns null word and sentence for steps without relations", async () => {
    const result = await getLesson({ lessonId: lesson.id });

    expect(result?.steps[0]?.word).toBeNull();
    expect(result?.steps[0]?.sentence).toBeNull();
  });

  test("excludes unpublished steps", async () => {
    const pubLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      language: "en",
      organizationId: org.id,
      position: 0,
    });

    const [pubStep1, , pubStep3] = await Promise.all([
      stepFixture({
        content: { text: "Published step 1", title: "Pub 1" },
        isPublished: true,
        lessonId: pubLesson.id,
        position: 0,
      }),
      stepFixture({
        content: { text: "Unpublished step", title: "Unpub" },
        isPublished: false,
        lessonId: pubLesson.id,
        position: 1,
      }),
      stepFixture({
        content: { text: "Published step 3", title: "Pub 3" },
        isPublished: true,
        lessonId: pubLesson.id,
        position: 2,
      }),
    ]);

    const result = await getLesson({ lessonId: pubLesson.id });

    expect(result?.steps).toHaveLength(2);
    expect(result?.steps[0]?.id).toBe(pubStep1.id);
    expect(result?.steps[1]?.id).toBe(pubStep3.id);
  });

  test("returns no steps when all are unpublished", async () => {
    const draftLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      language: "en",
      organizationId: org.id,
      position: 0,
    });

    await stepFixture({
      content: { text: "Draft step", title: "Draft" },
      lessonId: draftLesson.id,
      position: 0,
    });

    const result = await getLesson({ lessonId: draftLesson.id });

    expect(result?.steps).toHaveLength(0);
  });
});
