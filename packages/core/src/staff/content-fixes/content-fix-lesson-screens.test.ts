import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { generateLessonIconImage } from "@zoonk/ai/tasks/icons/image";
import { generateLessonImage } from "@zoonk/ai/tasks/images/generate";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import {
  answerExplanationFixture,
  libraryStepFixture,
  stepVariantFixture,
} from "@zoonk/testing/fixtures/library-steps";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { storeBlobUploads } from "../../_test-utils/blob-uploads";
import { mockSession } from "../../_test-utils/mock-session";
import { checkLessonStep } from "../../lesson-player/check-lesson-step";
import { completeLibraryLesson } from "../../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../../lesson-player/start-library-lesson";
import { drawnIcon } from "../../library/icons/_test-utils/icon-images";
import { CURRENT_STEPS, deleteRetiredSteps } from "../../library/lessons/lesson-versions";
import { writtenTemperatureLesson } from "../../library/quality/_test-utils/written-lessons";
import {
  approve,
  intro,
  optionsFor,
  proposeFix,
  publishedLesson,
  question,
  revertInAdmin,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { mockVoice } from "./_test-utils/mock-fix-voice";
import {
  listPendingFixMedia,
  produceFixIdeaIcon,
  recordFixClip,
  recordFixMedia,
} from "./prepare-content-fix-media";
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

    const [variant] = await Promise.all([
      stepVariantFixture({ content: intro, stepId: reading.id }),
      answerExplanationFixture({ stepId: reading.id }),
      answerExplanationFixture({ stepId: edited.id }),
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
          ![reading.id, check.id, edited.id, removed.id].includes(screen.id),
      ),
    ).toBe(true);

    expect(next[0]).toMatchObject({
      answerExplanations: [],
      content: { title: "Numbers" },
      model: "staff",
      promptVersion: "setScreens",
      runId: fix.id,
    });

    expect(next[1]).toMatchObject({
      generatedAt: reading.generatedAt,
      model: reading.model,
      promptVersion: reading.promptVersion,
      runId: reading.runId,
    });

    expect(next[3]).toMatchObject({ model: "staff", runId: fix.id });
    expect(next[1]?.answerExplanations).toHaveLength(1);

    const variantProvenance = {
      generatedAt: variant.generatedAt,
      model: variant.model,
      promptVersion: variant.promptVersion,
      runId: variant.runId,
    };

    expect(next[1]?.variants).toMatchObject([variantProvenance]);
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
    expect(restored[0]?.variants).toMatchObject([variantProvenance]);

    expect(restored[2]).toMatchObject({
      answerExplanations: [],
      generatedAt: edited.generatedAt,
      model: edited.model,
      promptVersion: edited.promptVersion,
      runId: edited.runId,
    });

    expect(restored.every((screen) => screen.version === 3)).toBe(true);
  });

  it("approves after learners cache answers on a kept screen", async () => {
    const { lesson, reading, check } = await publishedLesson();
    await signInProposer();

    const fix = await proposeFix({
      changes: [change(lesson.id, [{ id: reading.id }, { id: check.id }])],
      reason,
    });

    const explanation = await answerExplanationFixture({ stepId: check.id });

    const tutor = await prisma.tutorSharedAnswer.create({
      data: {
        answer: "Think of a number line.",
        model: "test",
        promptVersion: "1",
        question: "Can you make it simpler?",
        runId: "test",
        stepId: check.id,
        suggestion: "simpler",
      },
    });

    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    const screens = await current(lesson.id);
    const next = screens.find(({ kind }) => kind === "check");

    expect(next).toMatchObject({
      answerExplanations: [{ explanation: explanation.explanation }],
      sharedTutorAnswers: [{ answer: tutor.answer }],
      version: 2,
    });
  });

  it("reverts after a learner caches an explanation on the published fix", async () => {
    const { lesson, reading, check } = await publishedLesson();
    const { fix, key } = await apply([change(lesson.id, [{ id: reading.id }, { id: check.id }])]);

    const next = await prisma.step.findFirstOrThrow({
      where: { kind: "check", lessonId: lesson.id, ...CURRENT_STEPS },
    });

    await answerExplanationFixture({ stepId: next.id });

    const inverse = await revertInAdmin({ fixId: fix.id, reason: "Restore the previous screens" });

    if (inverse.status !== "proposed") {
      throw new Error(JSON.stringify(inverse));
    }

    await expect(approve({ fixId: inverse.fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    const screens = await current(lesson.id);
    const restored = screens.find(({ kind }) => kind === "check");
    expect(restored).toMatchObject({ answerExplanations: [], version: 3 });
  });

  it("reports unedited variants and preserves their provenance", async () => {
    const { lesson, reading, check } = await publishedLesson();

    const [edited, kept] = await Promise.all([
      stepVariantFixture({ content: intro, key: "law", kind: "field", stepId: reading.id }),
      stepVariantFixture({ content: intro, key: "nursing", kind: "field", stepId: reading.id }),
    ]);

    const { fix } = await apply([
      change(lesson.id, [
        {
          content: { ...intro, title: "Numbers" },
          id: reading.id,
          variants: [{ content: { ...intro, title: "Counting" }, id: edited.id }],
        },
        { id: check.id },
      ]),
    ]);

    expect(fix.effects).toContainEqual({ count: 1, kind: "variantsKept", stepId: reading.id });

    const [screen] = await current(lesson.id);

    expect(screen?.variants).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: { ...intro, title: "Counting" },
          key: edited.key,
          model: "staff",
          promptVersion: "setScreens",
          runId: fix.id,
        }),
        expect.objectContaining({
          content: intro,
          key: kept.key,
          model: kept.model,
          promptVersion: kept.promptVersion,
          runId: kept.runId,
        }),
      ]),
    );
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

  it.each(["LessonWord", "LessonSentence"] as const)(
    "keeps a newer screen-list translation when reverting a %s fix",
    async (model) => {
      const { lesson, sentence, steps, word } = await languageLessonFixture();
      const wordChange = model === "LessonWord";

      const { fix } = await apply([
        {
          id: wordChange
            ? { lessonId: lesson.id, wordId: word.id }
            : { lessonId: lesson.id, sentenceId: sentence.id },
          model,
          set: { translation: "Primeira correção" },
        },
      ]);

      const translation = "Correção mais recente";

      const { key } = await apply([
        change(
          lesson.id,
          steps.map(({ id }) => ({ id })),
          wordChange
            ? { words: [{ id: word.id, translation }] }
            : { sentences: [{ id: sentence.id, otherTranslationOrders: [], translation }] },
        ),
      ]);

      const inverse = await revertInAdmin({ fixId: fix.id, reason: "Undo the first correction" });

      if (inverse.status !== "proposed") {
        throw new Error(JSON.stringify(inverse));
      }

      await expect(approve({ fixId: inverse.fix.id, key })).resolves.toMatchObject({
        fix: { status: "stale" },
      });

      const row = wordChange
        ? await prisma.lessonWord.findFirstOrThrow({ where: { lessonId: lesson.id } })
        : await prisma.lessonSentence.findFirstOrThrow({ where: { lessonId: lesson.id } });

      expect(row.translation).toBe(translation);
    },
  );

  it("refuses to restore a screen list after a newer lesson word correction", async () => {
    const { lesson, steps, word } = await languageLessonFixture();

    const { fix } = await apply([
      change(
        lesson.id,
        steps.map(({ id }) => ({ id })),
        { words: [{ id: word.id, translation: "Primeira correção" }] },
      ),
    ]);

    const translation = "Correção mais recente";

    await apply([
      { id: { lessonId: lesson.id, wordId: word.id }, model: "LessonWord", set: { translation } },
    ]);

    await expect(
      revertInAdmin({ fixId: fix.id, reason: "Restore the original screen list" }),
    ).resolves.toMatchObject({
      message: expect.stringContaining("the lesson changed after approval"),
      status: "invalid",
    });

    await expect(
      prisma.lessonWord.findFirstOrThrow({ where: { lessonId: lesson.id } }),
    ).resolves.toMatchObject({ translation });
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
      {
        distractors: ["ma", "má"],
        key: "falling",
        romanization: " mà ",
        translation: "but",
        word: "mà",
      },
    ];

    const existing = await prisma.word.create({
      data: { organizationId: word.organizationId, targetLanguage: "vi", word: "má" },
    });

    const input = {
      changes: [
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
      ],
      reason,
    };

    await signInProposer();

    await expect(proposeContentFix(input, { check: true })).resolves.toMatchObject({
      fixes: [
        {
          media: [
            { kind: "clip", text: "má" },
            { kind: "clip", text: "mà" },
          ],
        },
      ],
      status: "checked",
    });

    const fix = await proposeFix(input);
    const { key } = await signInApprover();

    await expect(optionsFor(fix.id)).resolves.toMatchObject({ status: "changed" });
    expect(generateLanguageAudio).not.toHaveBeenCalled();

    mockVoice();
    const needs = await listPendingFixMedia(fix.id);
    const clips = needs.filter((need) => need.kind === "clip");
    const [first, second] = clips;

    if (!first || !second) {
      throw new Error("Expected both tone clips");
    }

    await recordFixClip({ fixId: fix.id, need: first });
    await expect(optionsFor(fix.id)).resolves.toMatchObject({ status: "changed" });
    await recordFixClip({ fixId: fix.id, need: second });
    expect(generateLanguageAudio).toHaveBeenCalledTimes(2);

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

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

    expect(words[1]?.word).toMatchObject({
      audioUrl: expect.stringContaining("blob.test"),
      id: existing.id,
    });

    expect(words[2]?.word).toMatchObject({
      audioUrl: expect.stringContaining("blob.test"),
      romanization: "mà",
    });

    expect(words[2]?.word.audioUrl).not.toBe(words[1]?.word.audioUrl);

    const inverse = await revertInAdmin({
      fixId: fix.id,
      reason: "Restore the previous vocabulary",
    });

    if (inverse.status !== "proposed") {
      throw new Error(JSON.stringify(inverse));
    }

    await expect(approve({ fixId: inverse.fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(prisma.lessonWord.count({ where: { lessonId: lesson.id } })).resolves.toBe(1);

    await expect(
      prisma.word.count({
        where: { audioUrl: { not: null }, id: { in: words.slice(1).map(({ wordId }) => wordId) } },
      }),
    ).resolves.toBe(2);

    expect(
      vi.mocked(generateLanguageAudio).mock.calls.map(([request]) => request.text),
    ).toStrictEqual(["má", "mà"]);
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

    await signInProposer();

    const fix = await proposeFix({
      changes: [
        change(lesson.id, [{ id: reading.id }, { content: { ideas }, kind: "summary" }], {
          ideas: [{ from: 2 }, { label: "Four", text: "Four apples." }],
        }),
      ],
      reason,
    });

    const [media] = await listPendingFixMedia(fix.id);

    if (media?.kind !== "ideaIcon") {
      throw new Error("Expected a pending idea icon");
    }

    storeBlobUploads();

    vi.mocked(generateLessonIconImage).mockResolvedValueOnce({
      data: { image: { mediaType: "image/png", uint8Array: new Uint8Array(await drawnIcon()) } },
      prompt: "test",
      provenance: {
        generatedAt: "2026-11-05T12:00:00.000Z",
        model: "openai/gpt-image-2.5-flare",
        promptVersion: "icon-style-test",
        runId: "idea-icon-test",
      },
    } as never);

    const result = await produceFixIdeaIcon({ fixId: fix.id, media });
    expect(result).toMatchObject({ kind: "ideaIcon" });
    await recordFixMedia({ fixId: fix.id, key: media.key, result });
    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({
      summary: {
        ideas: [
          { text: "Three apples." },
          { iconId: expect.any(String), label: "Four", text: "Four apples." },
        ],
      },
    });

    expect(generateLessonIconImage).toHaveBeenCalledOnce();

    const next = await current(lesson.id);
    expect(next[0]?.marks).toMatchObject({ ideaIndex: 0 });
    expect(next[1]?.content).toStrictEqual({ ideas: [ideas[2], { text: "Four apples." }] });
  });

  it("draws a numeric check and creates its practice item from the same calculation", async () => {
    const { lesson, reading } = await publishedLesson();
    const skill = await skillFixture();
    await prisma.lessonSkill.create({ data: { lessonId: lesson.id, skillId: skill.id } });

    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id, sourceSkillIds: [skill.id] });

    const version = async () => {
      const currentPlan = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
      return currentPlan.sourceVersion;
    };

    const numeric = writtenTemperatureLesson().screens.find(
      (screen) => screen.kind === "mathCheck",
    );

    if (numeric?.kind !== "mathCheck") {
      throw new Error("missing numeric fixture");
    }

    const { fix, key } = await apply([
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

    await expect(version()).resolves.toBe(plan.sourceVersion + 1);
    const inverse = await revertInAdmin({ fixId: fix.id, reason: "Restore the original practice" });

    if (inverse.status !== "proposed") {
      throw new Error(JSON.stringify(inverse));
    }

    await expect(approve({ fixId: inverse.fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(version()).resolves.toBe(plan.sourceVersion + 2);
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
