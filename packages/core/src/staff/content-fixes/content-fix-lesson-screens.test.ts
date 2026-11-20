import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { generateLessonIconImage } from "@zoonk/ai/tasks/icons/image";
import { generateLessonImage } from "@zoonk/ai/tasks/images/generate";
import { prisma } from "@zoonk/db";
import {
  answerExplanationFixture,
  libraryStepFixture,
  stepVariantFixture,
} from "@zoonk/testing/fixtures/library-steps";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { checkLessonStep } from "../../lesson-player/check-lesson-step";
import { completeLibraryLesson } from "../../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../../lesson-player/start-library-lesson";
import { CURRENT_STEPS, deleteRetiredSteps } from "../../library/lessons/lesson-versions";
import { writtenTemperatureLesson } from "../../library/quality/_test-utils/written-lessons";
import {
  approve,
  intro,
  proposeFix,
  publishedLesson,
  question,
  revertInAdmin,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { proposeContentFix } from "./propose-content-fix";

const reason = "Correct the lesson";

function change(id: string, screens: object[], fields: object = {}) {
  return { id, model: "Lesson", setScreens: { screens, version: 1, ...fields } };
}

function current(lessonId: string) {
  return prisma.step.findMany({
    include: { answerExplanations: true, item: true, sharedTutorAnswers: true, variants: true },
    orderBy: { position: "asc" },
    where: { lessonId, ...CURRENT_STEPS },
  });
}

async function apply(changes: object[]) {
  await signInProposer();
  const fix = await proposeFix({ changes, reason });
  const { key } = await signInApprover();

  await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
    fix: { status: "applied" },
  });

  return { fix, key };
}

describe("publishing one reviewed lesson screen version", () => {
  it("reorders, edits, removes and adds screens, remaps quotes and restores the reviewed snapshot after the retired sweep", async () => {
    const { lesson, reading, check } = await publishedLesson();

    const [edited, removed] = await Promise.all(
      [2, 3].map((position) =>
        libraryStepFixture({ content: intro, lessonId: lesson.id, position }),
      ),
    );

    if (!edited || !removed) {
      throw new Error("missing steps");
    }

    await Promise.all([
      answerExplanationFixture({ stepId: reading.id }),
      answerExplanationFixture({ stepId: edited.id }),
      stepVariantFixture({ content: intro, stepId: reading.id }),
    ]);

    const { fix, key } = await apply([
      change(lesson.id, [
        { content: { ...intro, title: "Numbers" }, id: edited.id },
        { id: reading.id },
        { id: check.id },
        { content: { ...intro, title: "Another example" }, kind: "explanation" },
      ]),
    ]);

    const next = await current(lesson.id);
    expect(next).toHaveLength(4);

    expect(
      next.every(
        (screen) =>
          screen.version === 2 &&
          screen.model === "staff" &&
          screen.runId === fix.id &&
          ![reading.id, check.id, edited.id, removed.id].includes(screen.id),
      ),
    ).toBe(true);

    expect(next[0]).toMatchObject({ answerExplanations: [], content: { title: "Numbers" } });
    expect(next[1]?.answerExplanations).toHaveLength(1);
    expect(next[1]?.variants).toHaveLength(1);
    expect(next[2]?.content).toMatchObject({ basis: { position: 1, quote: question.basis.quote } });

    await prisma.step.updateMany({
      data: { retiredAt: new Date(0) },
      where: { lessonId: lesson.id, version: 1 },
    });

    await deleteRetiredSteps();
    const inverse = await revertInAdmin({ fixId: fix.id, reason: "Restore the previous lesson" });

    if (inverse.status !== "proposed") {
      throw new Error(JSON.stringify(inverse));
    }

    await expect(approve({ fixId: inverse.fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    const calls = await prisma.aiCall.count({ where: { runId: { in: [fix.id, inverse.fix.id] } } });
    expect(calls).toBe(0);
    expect(generateLanguageAudio).not.toHaveBeenCalled();
    expect(generateLessonImage).not.toHaveBeenCalled();
    expect(generateLessonIconImage).not.toHaveBeenCalled();
    const restored = await current(lesson.id);
    expect(restored.map((screen) => screen.content)).toStrictEqual([intro, question, intro, intro]);
    expect(restored[0]?.variants).toHaveLength(1);
    expect(restored[2]?.answerExplanations).toHaveLength(1);
    expect(restored.every((screen) => screen.version === 3)).toBe(true);
  });

  it("refuses both a lost quote and an unknown skill and rejects overlapping batch writes", async () => {
    const { lesson, check, reading } = await publishedLesson();
    await signInProposer();

    const invalid = await proposeContentFix({
      changes: [
        change(lesson.id, [
          { id: check.id },
          { content: intro, kind: "explanation", skillId: crypto.randomUUID() },
        ]),
      ],
      reason,
    });

    expect(invalid).toMatchObject({
      message: expect.stringContaining("screens[0].content.basis.position"),
      status: "invalid",
    });

    expect(invalid).toMatchObject({ message: expect.stringContaining("screens[1].skillId") });

    const overlap = await proposeContentFix({
      fixes: [
        { changes: [change(lesson.id, [{ id: reading.id }])] },
        {
          changes: [
            {
              id: check.id,
              model: "Step",
              set: { content: { ...question, question: "What is the sum?" } },
            },
          ],
        },
      ],
      reason,
    });

    expect(overlap).toMatchObject({
      message: expect.stringContaining("also changes"),
      status: "invalid",
    });
  });

  it("detects an in-place edit after review and publishes nothing", async () => {
    const { lesson, reading } = await publishedLesson();
    await signInProposer();
    const fix = await proposeFix({ changes: [change(lesson.id, [{ id: reading.id }])], reason });

    await prisma.step.update({
      data: { content: { ...intro, title: "Changed while waiting" } },
      where: { id: reading.id },
    });

    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "stale" },
    });

    await expect(current(lesson.id)).resolves.toHaveLength(2);
  });

  it("publishes two Vietnamese tones with their recordings, translations and existing map ideas", async () => {
    const { lesson, steps, word, sentence } = await languageLessonFixture({
      language: "en",
      wordText: "ma",
      wordTranslation: "ghost",
    });

    const ideas = [
      { text: "Ma means ghost." },
      { text: "Má means mom." },
      { text: "Mà means but." },
    ];

    await Promise.all([
      prisma.lesson.update({
        data: { summary: { ideas }, targetLanguage: "vi" },
        where: { id: lesson.id },
      }),
      prisma.word.update({ data: { targetLanguage: "vi" }, where: { id: word.id } }),
      prisma.sentence.update({ data: { targetLanguage: "vi" }, where: { id: sentence.id } }),
    ]);

    const additions = [
      { distractors: ["ma", "mà"], key: "rising", translation: "mom", word: "má" },
      { distractors: ["ma", "má"], key: "falling", translation: "but", word: "mà" },
    ];

    await prisma.word.createMany({
      data: additions.map((row) => ({
        audioUrl: `https://audio.test/${row.key}.mp3`,
        organizationId: word.organizationId,
        targetLanguage: "vi",
        word: row.word,
      })),
    });

    await apply([
      change(
        lesson.id,
        [
          ...steps.map(({ id }) => ({ id })),
          ...additions.flatMap((row, i) =>
            ["vocabulary", "translation"].map((kind) => ({ idea: i + 1, kind, word: row.key })),
          ),
        ],
        { words: [{ id: word.id }, ...additions] },
      ),
    ]);

    const words = await prisma.lessonWord.findMany({
      include: { word: true },
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    });

    expect(words.map((row) => [row.word.word, row.translation])).toStrictEqual([
      ["ma", "ghost"],
      ["má", "mom"],
      ["mà", "but"],
    ]);

    const screens = await current(lesson.id);
    const added = screens.slice(steps.length);

    expect(added.map(({ kind, wordId }) => [kind, wordId])).toStrictEqual(
      additions.flatMap((_, index) =>
        ["vocabulary", "translation"].map((kind) => [kind, words[index + 1]?.wordId]),
      ),
    );

    expect(added.map(({ marks }) => marks)).toMatchObject([
      { ideaIndex: 1 },
      { ideaIndex: 1 },
      { ideaIndex: 2 },
      { ideaIndex: 2 },
    ]);
  });

  it("moves marks by idea identity and regenerates the closing summary from the final ideas", async () => {
    const { lesson, reading } = await publishedLesson();
    const ideas = [{ text: "One apple." }, { text: "Two apples." }, { text: "Three apples." }];

    await Promise.all([
      prisma.lesson.update({ data: { summary: { ideas } }, where: { id: lesson.id } }),
      prisma.step.update({
        data: {
          marks: { example: null, iconId: null, iconPending: false, ideaIndex: 2, underline: null },
        },
        where: { id: reading.id },
      }),
    ]);

    await apply([
      change(lesson.id, [{ id: reading.id }, { content: { ideas }, kind: "summary" }], {
        ideas: [{ from: 2 }, { label: "Four", text: "Four apples." }],
      }),
    ]);

    const next = await current(lesson.id);
    expect(next[0]?.marks).toMatchObject({ ideaIndex: 0 });
    expect(next[1]?.content).toStrictEqual({ ideas: [ideas[2], { text: "Four apples." }] });
  });

  it("draws a numeric check and creates its practice item from the same calculation", async () => {
    const { lesson, reading } = await publishedLesson();
    const skill = await skillFixture();
    await prisma.lessonSkill.create({ data: { lessonId: lesson.id, skillId: skill.id } });

    const numeric = writtenTemperatureLesson().screens.find(
      (screen) => screen.kind === "mathCheck",
    );

    if (numeric?.kind !== "mathCheck") {
      throw new Error("missing numeric fixture");
    }

    await apply([
      change(lesson.id, [
        { id: reading.id },
        {
          kind: "check",
          numeric: {
            context: numeric.context,
            correctReason: numeric.correctReason,
            math: numeric.math,
            question: numeric.question,
          },
          skillId: skill.id,
        },
      ]),
    ]);

    const screens = await current(lesson.id);

    expect(screens[1]).toMatchObject({
      content: { options: expect.any(Array) },
      item: { format: "numeric", model: "staff", skillId: skill.id },
      kind: "check",
    });
  });

  it("finishes the old version when its only graded screen was excused before any answer was saved", async () => {
    const { lesson, word, steps } = await languageLessonFixture();
    const translation = steps.find((screen) => screen.kind === "translation");

    if (!translation) {
      throw new Error("missing translation");
    }

    await prisma.step.deleteMany({ where: { kind: { not: "translation" }, lessonId: lesson.id } });
    await prisma.lessonSentence.deleteMany({ where: { lessonId: lesson.id } });
    const user = await userFixture();
    mockSession(user.id);
    const start = await startLibraryLesson({ input: { timeZone: "UTC" }, lessonId: lesson.id });

    if (start.status !== "started") {
      throw new Error("run did not start");
    }

    const input = { durationMs: 3000, runId: start.run.runId, timeZone: "UTC" };

    await apply([
      change(lesson.id, [{ content: { ...question, basis: null }, kind: "check" }], { words: [] }),
    ]);

    mockSession(user.id);

    await expect(
      checkLessonStep({
        input: { ...input, answer: { kind: "translation", selectedOptionId: word.id } },
        stepId: translation.id,
      }),
    ).resolves.toMatchObject({ result: { checked: false }, status: "checked" });

    await expect(completeLibraryLesson({ input, lessonId: lesson.id })).resolves.toMatchObject({
      completion: { correctCount: 0, incorrectCount: 0 },
      status: "completed",
    });
  });

  it("finishes an open run after a fix removes its word, without saving an incorrect answer", async () => {
    const { lesson, steps, word } = await languageLessonFixture();
    const translation = steps.find((screen) => screen.kind === "translation");

    const check = await libraryStepFixture({
      content: { ...question, basis: null },
      kind: "check",
      lessonId: lesson.id,
      position: 5,
    });

    if (!translation) {
      throw new Error("missing translation");
    }

    const user = await userFixture();
    mockSession(user.id);
    const start = await startLibraryLesson({ input: { timeZone: "UTC" }, lessonId: lesson.id });

    if (start.status !== "started") {
      throw new Error("run did not start");
    }

    const input = { durationMs: 3000, runId: start.run.runId, timeZone: "UTC" };

    await checkLessonStep({
      input: { ...input, answer: { kind: "check", optionId: "a" } },
      stepId: check.id,
    });

    await apply([change(lesson.id, [{ id: check.id }], { sentences: [], words: [] })]);
    mockSession(user.id);

    await expect(
      checkLessonStep({
        input: { ...input, answer: { kind: "translation", selectedOptionId: word.id } },
        stepId: translation.id,
      }),
    ).resolves.toMatchObject({ result: { checked: false }, status: "checked" });

    await expect(completeLibraryLesson({ input, lessonId: lesson.id })).resolves.toMatchObject({
      completion: { correctCount: 1, incorrectCount: 0 },
      status: "completed",
    });
  });
});
