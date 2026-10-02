import { randomUUID } from "node:crypto";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { mediaAssetFixture, stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
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
import { stepOfKind } from "./_test-utils/playable-lesson-setup";
import { getLibraryLessonOutline, getPlayableLibraryLesson } from "./get-playable-library-lesson";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(async () => false),
}));

describe(getPlayableLibraryLesson, () => {
  // Screens load only with a session, so most cases play as a signed-in learner.
  beforeEach(() => {
    mockSession(randomUUID());
  });

  it("serves every screen in order with its parsed content, image and depth versions, with their ids", async () => {
    const image = await mediaAssetFixture({ height: 1024, width: 1536 });

    const { lesson, steps } = await playableLessonFixture({
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

    const explanation = stepOfKind(steps, "explanation");

    const simpler = await stepVariantFixture({
      content: { text: "Think of a blur instead of a dot." },
      kind: "simpler",
      stepId: explanation.id,
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
      variants: {
        deeper: null,
        simpler: { content: { text: "Think of a blur instead of a dot." }, id: simpler.id },
      },
    });

    expect(playable?.steps[5]).toMatchObject({ exercise: { kind: "multipleChoice" } });
    expect(JSON.stringify(result)).not.toContain("test/fixture-model");
  });

  it("reads depth versions on every load, so one written after a read shows on the next", async () => {
    const { lesson, steps } = await playableLessonFixture({
      steps: ["explanation", "workedExample", "check"],
    });

    const first = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(first?.status === "ready" && first.lesson.steps[1]).toMatchObject({
      variants: { deeper: null, simpler: null },
    });

    // Versions are written while learners play, by main or the API, whose caches never meet.
    const deeper = await stepVariantFixture({
      content: { ...playableStepContent.workedExample, title: "Reading the probability density" },
      kind: "deeper",
      stepId: stepOfKind(steps, "workedExample").id,
    });

    const second = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(second?.status === "ready" && second.lesson.steps[1]).toMatchObject({
      variants: {
        deeper: { content: { title: "Reading the probability density" }, id: deeper.id },
        simpler: null,
      },
    });

    expect(second?.status === "ready" && second.lesson.steps[0]).toMatchObject({
      variants: { deeper: null, simpler: null },
    });
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

  it("slows down a learner reading screens too fast, keyed on the account or a guest's network", async () => {
    const { lesson } = await playableLessonFixture({ steps: TEACHING_LESSON_STEPS });
    const learnerId = randomUUID();
    mockSession(learnerId);
    vi.mocked(isRateLimited).mockResolvedValueOnce(true);

    const limited = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(limited).toStrictEqual({
      lesson: {
        description: lesson.description,
        estimatedMinutes: lesson.estimatedMinutes,
        id: lesson.id,
        language: lesson.language,
        title: lesson.title,
      },
      retryAfterSeconds: 60,
      status: "slowDown",
    });

    expect(isRateLimited).toHaveBeenCalledWith(
      expect.objectContaining({ key: `user:${learnerId}`, rule: "lesson-steps" }),
    );

    mockGuestSession(randomUUID());
    await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(vi.mocked(isRateLimited).mock.lastCall?.[0].key).not.toMatch(/^user:/u);

    // Visitors only get the outline, so their reads aren't counted.
    vi.mocked(isRateLimited).mockClear();
    mockSession(null);
    await getPlayableLibraryLesson({ lessonId: lesson.id });
    expect(isRateLimited).not.toHaveBeenCalled();
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
    expect(isRateLimited).not.toHaveBeenCalled();
  });
});
