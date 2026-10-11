import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import {
  languageLessonFixture,
  playableLessonFixture,
} from "@zoonk/testing/fixtures/playable-lessons";
import {
  TEACHING_LESSON_STEPS,
  playableStepContent,
} from "@zoonk/testing/fixtures/playable-step-contents";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { validateActivity } from "../library/activities/validate-activity";
import { PPTX_CONTENT_TYPE } from "../library/sources/source-contract";
import { getLibraryLessonOutline, getPlayableLibraryLesson } from "./get-playable-library-lesson";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

describe(getPlayableLibraryLesson, () => {
  // Screens load only with a session, so most cases play as a signed-in learner.
  beforeEach(() => {
    mockSession(randomUUID());
  });

  it("serves every screen in order with its parsed content and image", async () => {
    const image = await mediaAssetFixture({ height: 1024, width: 1536 });

    const { lesson } = await playableLessonFixture({
      steps: [
        "hook",
        {
          content: {
            ...playableStepContent.explanation,
            image: { alt: "A fuzzy blue cloud around a red nucleus", prompt: "Electron cloud" },
          },
          kind: "explanation",
          mediaAssetId: image.id,
        },
        "check",
        "typedAnswer",
        "summary",
        "multipleChoice",
      ],
    });

    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(result?.status).toBe("ready");

    const playable = result?.status === "ready" ? result.lesson : null;

    expect(playable?.steps.map((step) => step.kind)).toStrictEqual([
      "hook",
      "explanation",
      "check",
      "typedAnswer",
      "summary",
      "multipleChoice",
    ]);

    expect(playable?.steps[1]).toMatchObject({
      content: { title: "A cloud, not a little ball" },
      image: {
        alt: "A fuzzy blue cloud around a red nucleus",
        height: 1024,
        id: image.id,
        url: image.url,
        width: 1536,
      },
    });

    expect(playable?.steps[5]).toMatchObject({ exercise: { kind: "multipleChoice" } });
    expect(JSON.stringify(result)).not.toContain("test/fixture-model");
  });

  it("sends a written lesson's screens only with a session, a guest's included", async () => {
    const { lesson } = await playableLessonFixture({ steps: TEACHING_LESSON_STEPS });

    mockSession(null);
    const visitor = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(visitor).toStrictEqual({
      lesson: {
        description: lesson.description,
        estimatedMinutes: lesson.estimatedMinutes,
        id: lesson.id,
        language: lesson.language,
        title: lesson.title,
      },
      status: "sessionRequired",
    });

    expect(JSON.stringify(visitor)).not.toContain('"steps"');

    mockGuestSession(randomUUID());
    const guest = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(guest?.status === "ready" ? guest.lesson.steps.length : 0).toBe(
      TEACHING_LESSON_STEPS.length,
    );
  });

  it("serves the lesson's summary card for the lesson menu, and none when it has none", async () => {
    const [withSummary, withoutSummary] = await Promise.all([
      playableLessonFixture({
        lesson: {
          summary: {
            ideas: [{ text: "Electrons live in clouds." }, { text: "Clouds are fuzzy." }],
          },
        },
      }),
      playableLessonFixture(),
    ]);

    const [first, second] = await Promise.all([
      getPlayableLibraryLesson({ lessonId: withSummary.lesson.id }),
      getPlayableLibraryLesson({ lessonId: withoutSummary.lesson.id }),
    ]);

    expect(first?.status === "ready" && first.lesson.summaryIdeas).toStrictEqual([
      "Electrons live in clouds.",
      "Clouds are fuzzy.",
    ]);

    expect(second?.status === "ready" && second.lesson.summaryIdeas).toStrictEqual([]);
  });

  it("serves the shared fixture content of every kind, so tests play valid lessons", async () => {
    const kinds = [...TEACHING_LESSON_STEPS, "activity", "fillBlank", "multipleChoice"] as const;

    const { lesson } = await playableLessonFixture({ steps: [...kinds] });

    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(
      result?.status === "ready" && result.lesson.steps.map((step) => step.kind),
    ).toStrictEqual(kinds);

    expect(validateActivity(playableStepContent.activity)).toMatchObject({ ok: true });
  });

  it("serves language screens with the pair's translation, note, sound tip and word banks", async () => {
    const { lesson, word } = await languageLessonFixture();

    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
    const steps = result?.status === "ready" ? result.lesson.steps : [];

    expect(steps.map((step) => step.kind)).toStrictEqual([
      "vocabulary",
      "translation",
      "reading",
      "listening",
      "spokenAnswer",
    ]);

    expect(steps[0]).toMatchObject({
      exercise: {
        word: { id: word.id, pronunciation: "rént", translation: "aluguel", word: "rent" },
      },
      wordHints: {
        note: "Não confunda com renda, que é income.",
        pronunciationTip: "O r do começo é suave, não como em rato.",
      },
    });

    const translation = steps[1];

    expect(
      translation && "exercise" in translation
        ? translation.exercise.translationOptions.map((option) => option.word).toSorted()
        : [],
    ).toStrictEqual(["Bill", "Deposit", "Rent"]);

    expect(steps[2]).toMatchObject({
      exercise: {
        sentence: { sentence: "How much is the rent?", translation: "Quanto é o aluguel?" },
      },
      wordHints: null,
    });

    // "I can't talk now" plays the spoken sentence as the lesson's listening exercise.
    expect(steps[4]).toMatchObject({
      kind: "spokenAnswer",
      listening: {
        kind: "listening",
        sentence: { sentence: "How much is the rent?", translation: "Quanto é o aluguel?" },
      },
    });
  });

  it("leaves out screens that show their own answer, such as an English word for English readers defined by itself", async () => {
    const [ownLanguage, silent] = await Promise.all([
      languageLessonFixture({
        language: "en",
        sentenceAudioUrl: "https://audio.zoonk.test/en-rent.mp3",
        sentenceTranslation: "How much is the rent?",
        wordTranslation: "rent",
      }),
      languageLessonFixture({
        language: "en",
        sentenceTranslation: "How much is the rent?",
        wordTranslation: "money you pay each month to live somewhere",
      }),
    ]);

    const [heard, unheard] = await Promise.all([
      getPlayableLibraryLesson({ lessonId: ownLanguage.lesson.id }),
      getPlayableLibraryLesson({ lessonId: silent.lesson.id }),
    ]);

    // "rent: rent" teaches nothing, and building "How much is the rent?" from the same sentence
    // (or from no recording) tests nothing; hearing it and building it does.
    expect(heard?.status === "ready" && heard.lesson.steps.map((step) => step.kind)).toStrictEqual([
      "listening",
      "spokenAnswer",
    ]);

    expect(
      unheard?.status === "ready" && unheard.lesson.steps.map((step) => step.kind),
    ).toStrictEqual(["vocabulary", "translation", "spokenAnswer"]);

    expect(unheard?.status === "ready" && unheard.lesson.steps.at(-1)).toMatchObject({
      kind: "spokenAnswer",
      listening: null,
    });
  });

  it("drops screens it can't serve instead of failing the lesson", async () => {
    const { lesson } = await playableLessonFixture({
      steps: [
        "explanation",
        { content: { text: "" }, kind: "explanation" },
        { content: {}, kind: "check" },
        "check",
      ],
    });

    await prisma.step.create({
      data: {
        content: {},
        kind: "vocabulary",
        lessonId: lesson.id,
        model: "test",
        position: 10,
        promptVersion: "test",
        runId: randomUUID(),
      },
    });

    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(
      result?.status === "ready" && result.lesson.steps.map((step) => step.kind),
    ).toStrictEqual(["explanation", "check"]);
  });

  it("keeps playing a lesson whose screens use a template merged into an engine since", async () => {
    // Stored before sliderGraph and supplyDemand became formulaModel and lineCrossing.
    const retiredActivity = {
      check: { explanation: "Why.", kind: "interaction" },
      fields: { formula: "rate", output: { label: "Value" }, variable: { name: "rate" } },
      prompt: "Move the rate.",
      template: "sliderGraph",
    };

    const { lesson } = await playableLessonFixture({
      steps: [
        {
          content: {
            explore: { fields: { event: "Bird flu." }, template: "supplyDemand" },
            text: "Prices rise when supply falls.",
          },
          kind: "explanation",
        },
        { content: retiredActivity, kind: "activity" },
        "check",
      ],
    });

    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
    const steps = result?.status === "ready" ? result.lesson.steps : [];
    const [explanation] = steps;

    expect(steps.map((step) => step.kind)).toStrictEqual(["explanation", "check"]);

    expect(explanation?.kind === "explanation" && explanation.content).toStrictEqual({
      explore: undefined,
      text: "Prices rise when supply falls.",
    });
  });

  it("cites a public document with the date it was checked, the learner's material by its slide, and says what isn't in it", async () => {
    const owner = await userFixture();
    const checkedAt = new Date("2026-09-12T10:00:00.000Z");
    const url = "https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm";

    const [{ lesson, steps }, law, slides] = await Promise.all([
      playableLessonFixture({
        lesson: { ownerId: owner.id, visibility: "private" },
        steps: ["explanation", "check", "explanation"],
      }),
      sourceFixture({ fetchedAt: checkedAt, publisher: "Planalto", title: "Law 8,112", url }),
      sourceFixture({
        kind: "upload",
        mimeType: PPTX_CONTENT_TYPE,
        ownerId: owner.id,
        title: "Class 2",
        url: null,
        visibility: "private",
      }),
    ]);

    await Promise.all([
      prisma.step.update({ data: { sourceId: law.id }, where: { id: steps[0]?.id } }),
      prisma.step.update({
        data: { sourceId: slides.id, sourcePage: 4 },
        where: { id: steps[1]?.id },
      }),
    ]);

    mockSession(owner.id);
    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(
      result?.status === "ready" &&
        result.lesson.steps.map((step) => ("citation" in step ? step.citation : null)),
    ).toStrictEqual([
      { checkedAt, kind: "source", publisher: "Planalto", title: "Law 8,112", url },
      { kind: "material", page: 4, title: "Class 2", unit: "slide" },
      { kind: "notInMaterial" },
    ]);
  });

  it("leaves uncited screens alone in a lesson that doesn't come from the learner's material", async () => {
    const [user, { lesson }] = await Promise.all([
      userFixture(),
      playableLessonFixture({ steps: ["explanation", "check"] }),
    ]);

    mockSession(user.id);
    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(
      result?.status === "ready" &&
        result.lesson.steps.map((step) => ("citation" in step ? step.citation : null)),
    ).toStrictEqual([null, null]);
  });

  it("returns the outline of a lesson whose content isn't written yet, to visitors too", async () => {
    const lesson = await libraryLessonFixture({ title: "Why colors exist" });

    mockSession(null);

    await expect(getPlayableLibraryLesson({ lessonId: lesson.id })).resolves.toStrictEqual({
      lesson: {
        description: lesson.description,
        estimatedMinutes: lesson.estimatedMinutes,
        id: lesson.id,
        language: "en",
        title: "Why colors exist",
      },
      status: "notGenerated",
    });
  });

  it("shows a private lesson only to its owner", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const { lesson } = await playableLessonFixture({
      lesson: { ownerId: owner.id, visibility: "private" },
      steps: TEACHING_LESSON_STEPS,
    });

    mockSession(other.id);
    await expect(getPlayableLibraryLesson({ lessonId: lesson.id })).resolves.toBeNull();

    mockSession(owner.id);
    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
    expect(result?.status).toBe("ready");
  });

  it("returns null for ids that aren't lessons", async () => {
    await expect(getPlayableLibraryLesson({ lessonId: "not-a-uuid" })).resolves.toBeNull();
    await expect(getPlayableLibraryLesson({ lessonId: randomUUID() })).resolves.toBeNull();
  });
});

describe(getLibraryLessonOutline, () => {
  it("names a lesson for its page without its screens or counting a read, and only to who can see it", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const [{ lesson }, { lesson: privateLesson }] = await Promise.all([
      playableLessonFixture({ steps: TEACHING_LESSON_STEPS }),
      playableLessonFixture({
        lesson: { ownerId: owner.id, visibility: "private" },
        steps: TEACHING_LESSON_STEPS,
      }),
    ]);

    mockSession(other.id);

    await expect(getLibraryLessonOutline({ lessonId: lesson.id })).resolves.toStrictEqual({
      description: lesson.description,
      estimatedMinutes: lesson.estimatedMinutes,
      id: lesson.id,
      language: lesson.language,
      title: lesson.title,
    });

    await expect(getLibraryLessonOutline({ lessonId: privateLesson.id })).resolves.toBeNull();
    await expect(getLibraryLessonOutline({ lessonId: "not-a-uuid" })).resolves.toBeNull();
  });
});
