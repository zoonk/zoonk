import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, test } from "vitest";
import { getActivity } from "./get-activity";

describe(getActivity, () => {
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;
  let activity: Awaited<ReturnType<typeof activityFixture>>;
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
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    activity = await activityFixture({
      description: "Test activity description",
      generationStatus: "completed",
      isPublished: true,
      kind: "background",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 0,
      title: "Test Activity",
    });

    [step1, step2] = await Promise.all([
      stepFixture({
        activityId: activity.id,
        content: { text: "Step 1 content", title: "Step 1" },
        isPublished: true,
        position: 0,
      }),
      stepFixture({
        activityId: activity.id,
        content: { text: "Step 2 content", title: "Step 2" },
        isPublished: true,
        position: 1,
      }),
    ]);
  });

  test("returns activity with steps", async () => {
    const result = await getActivity({ lessonId: lesson.id, position: 0 });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(activity.id);
    expect(result?.title).toBe("Test Activity");
    expect(result?.description).toBe("Test activity description");
    expect(result?.kind).toBe("background");
    expect(result?.steps).toHaveLength(2);
  });

  test("orders steps by position ascending", async () => {
    const result = await getActivity({ lessonId: lesson.id, position: 0 });

    expect(result?.steps[0]?.id).toBe(step1.id);
    expect(result?.steps[0]?.position).toBe(0);
    expect(result?.steps[1]?.id).toBe(step2.id);
    expect(result?.steps[1]?.position).toBe(1);
  });

  test("returns generation status", async () => {
    const result = await getActivity({ lessonId: lesson.id, position: 0 });

    expect(result?.generationStatus).toBe("completed");
  });

  test("returns null for unpublished activity", async () => {
    const draftActivity = await activityFixture({
      isPublished: false,
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 1,
    });

    const result = await getActivity({ lessonId: lesson.id, position: draftActivity.position });

    expect(result).toBeNull();
  });

  test("returns null for non-existent position", async () => {
    const result = await getActivity({ lessonId: lesson.id, position: 999 });

    expect(result).toBeNull();
  });

  test("returns null for non-existent lesson", async () => {
    const result = await getActivity({ lessonId: 999_999, position: 0 });

    expect(result).toBeNull();
  });

  test("includes step content and visual information", async () => {
    const result = await getActivity({ lessonId: lesson.id, position: 0 });

    expect(result?.steps[0]?.content).toEqual({ text: "Step 1 content", title: "Step 1" });
    expect(result?.steps[0]?.kind).toBe("static");
  });

  test("returns language and organizationId on the activity", async () => {
    const result = await getActivity({ lessonId: lesson.id, position: 0 });

    expect(result?.language).toBe("en");
    expect(result?.organizationId).toBe(org.id);
  });

  test("returns word data when step has word relation", async () => {
    const wordLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    const [wordActivity, word] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        language: "en",
        lessonId: wordLesson.id,
        organizationId: org.id,
        position: 0,
      }),
      wordFixture({
        audioUrl: "https://example.com/audio.mp3",
        organizationId: org.id,
        pronunciation: "test-pron",
        romanization: "test-roman",
        translation: "test-translation",
        word: `test-word-${crypto.randomUUID()}`,
      }),
    ]);

    await stepFixture({
      activityId: wordActivity.id,
      isPublished: true,
      position: 0,
      wordId: word.id,
    });

    const result = await getActivity({ lessonId: wordLesson.id, position: 0 });

    expect(result?.steps[0]?.word).toEqual({
      audioUrl: "https://example.com/audio.mp3",
      id: word.id,
      pronunciation: "test-pron",
      romanization: "test-roman",
      translation: "test-translation",
      word: word.word,
    });
  });

  test("returns sentence data when step has sentence relation", async () => {
    const sentLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    const [sentActivity, sentence] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        language: "en",
        lessonId: sentLesson.id,
        organizationId: org.id,
        position: 0,
      }),
      sentenceFixture({
        audioUrl: "https://example.com/sent-audio.mp3",
        organizationId: org.id,
        romanization: "test-sent-roman",
        sentence: `test-sentence-${crypto.randomUUID()}`,
        translation: "test-sent-translation",
      }),
    ]);

    await stepFixture({
      activityId: sentActivity.id,
      isPublished: true,
      position: 0,
      sentenceId: sentence.id,
    });

    const result = await getActivity({ lessonId: sentLesson.id, position: 0 });

    expect(result?.steps[0]?.sentence).toEqual({
      audioUrl: "https://example.com/sent-audio.mp3",
      id: sentence.id,
      romanization: "test-sent-roman",
      sentence: sentence.sentence,
      translation: "test-sent-translation",
    });
  });

  test("returns null word and sentence for steps without relations", async () => {
    const result = await getActivity({ lessonId: lesson.id, position: 0 });

    expect(result?.steps[0]?.word).toBeNull();
    expect(result?.steps[0]?.sentence).toBeNull();
  });

  test("excludes unpublished steps", async () => {
    const pubLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    const pubActivity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "background",
      language: "en",
      lessonId: pubLesson.id,
      organizationId: org.id,
      position: 0,
    });

    const [pubStep1, , pubStep3] = await Promise.all([
      stepFixture({
        activityId: pubActivity.id,
        content: { text: "Published step 1", title: "Pub 1" },
        isPublished: true,
        position: 0,
      }),
      stepFixture({
        activityId: pubActivity.id,
        content: { text: "Unpublished step", title: "Unpub" },
        isPublished: false,
        position: 1,
      }),
      stepFixture({
        activityId: pubActivity.id,
        content: { text: "Published step 3", title: "Pub 3" },
        isPublished: true,
        position: 2,
      }),
    ]);

    const result = await getActivity({ lessonId: pubLesson.id, position: 0 });

    expect(result?.steps).toHaveLength(2);
    expect(result?.steps[0]?.id).toBe(pubStep1.id);
    expect(result?.steps[1]?.id).toBe(pubStep3.id);
  });

  test("returns no steps when all are unpublished", async () => {
    const draftLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    const draftActivity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "background",
      language: "en",
      lessonId: draftLesson.id,
      organizationId: org.id,
      position: 0,
    });

    await stepFixture({
      activityId: draftActivity.id,
      content: { text: "Draft step", title: "Draft" },
      position: 0,
    });

    const result = await getActivity({ lessonId: draftLesson.id, position: 0 });

    expect(result?.steps).toHaveLength(0);
  });
});
