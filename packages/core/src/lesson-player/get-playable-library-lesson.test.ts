import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import {
  languageLessonFixture,
  lessonIconFixture,
  markedPlayableLessonFixture,
  playableLessonFixture,
} from "@zoonk/testing/fixtures/playable-lessons";
import {
  TEACHING_LESSON_STEPS,
  playableStepContent,
} from "@zoonk/testing/fixtures/playable-step-contents";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeEach, describe, expect, it } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { validateActivity } from "../library/activities/validate-activity";
import { MAX_SENTENCE_ORDERS_ATTEMPTS } from "../library/language/sentence-orders-constants";
import { readSavedLessonMap } from "../library/lessons/lesson-map";
import { readSavedStepMarks } from "../library/marks/step-marks";
import { PPTX_CONTENT_TYPE } from "../library/sources/source-contract";
import { CAPSULE_LEDGER_KIND } from "../milestones/award-milestones";
import { lessonRunFixture } from "./_test-utils/lesson-run-fixture";
import { setupPlayableLesson, stepOfKind } from "./_test-utils/playable-lesson-setup";
import { checkLessonStep } from "./check-lesson-step";
import { completeLibraryLesson } from "./complete-library-lesson";
import { getLibraryLessonOutline, getPlayableLibraryLesson } from "./get-playable-library-lesson";
import { startLibraryLesson } from "./start-library-lesson";

const FIVE_OPTION_CHECK = {
  ...playableStepContent.check,
  options: [
    ...playableStepContent.check.options,
    {
      id: "speed",
      isCorrect: false,
      reason: "It shows chances, not speed.",
      text: "How fast it moves",
    },
    { id: "charge", isCorrect: false, reason: "It shows chances, not charge.", text: "Its charge" },
  ],
};

const STORED_CHECK_ORDER = FIVE_OPTION_CHECK.options.map((option) => option.id);

async function shownCheckOrder(lessonId: string) {
  const result = await getPlayableLibraryLesson({ lessonId });
  const steps = result?.status === "ready" ? result.lesson.steps : [];
  const check = steps.find((step) => step.kind === "check");
  return check?.kind === "check" ? check.content.options.map((option) => option.id) : [];
}

/** Plays the lesson through, tapping the check's right option by its id, and finishes it. */
async function sitThrough({ checkId, lessonId }: { checkId: string; lessonId: string }) {
  const started = await startLibraryLesson({ input: { timeZone: "UTC" }, lessonId });
  const runId = started.status === "started" ? started.run.runId : "";

  const checked = await checkLessonStep({
    input: {
      answer: { kind: "check", optionId: "likely" },
      durationMs: 5000,
      runId,
      timeZone: "UTC",
    },
    stepId: checkId,
  });

  const completed = await completeLibraryLesson({ input: { runId, timeZone: "UTC" }, lessonId });
  return { checked, completed };
}

function exploring(template: "formulaModel" | "processOrder", fields: unknown) {
  return {
    content: { ...playableStepContent.explanation, explore: { fields, template } },
    kind: "explanation" as const,
  };
}

describe(getPlayableLibraryLesson, () => {
  beforeEach(() => {
    mockSession(randomUUID());
  });

  it("keeps the same reading tiles across lesson reads when more than four distractors are stored", async () => {
    const { lesson, sentence } = await languageLessonFixture();
    const distractors = ["are", "many", "cost", "pay", "house", "flat"];

    await prisma.lessonSentence.update({
      data: { distractors },
      where: { lessonId_sentenceId: { lessonId: lesson.id, sentenceId: sentence.id } },
    });

    async function readTiles() {
      const result = await getPlayableLibraryLesson({ lessonId: lesson.id });

      const reading =
        result?.status === "ready" && result.lesson.steps.find((step) => step.kind === "reading");

      if (!reading || !("exercise" in reading)) {
        throw new Error("Expected a reading step");
      }

      return reading.exercise.wordBankOptions.map((option) => option.word);
    }

    const first = await readTiles();

    expect(first.filter((word) => distractors.includes(word)).toSorted()).toStrictEqual([
      "are",
      "cost",
      "many",
      "pay",
    ]);

    await expect(readTiles()).resolves.toStrictEqual(first);
  });

  it("lays a check's options out in one order for a sitting, a new one once the lesson is finished, and grades the option tapped", async () => {
    const { lesson, steps } = await setupPlayableLesson({
      steps: [{ content: FIVE_OPTION_CHECK, kind: "check" }, "summary"],
    });

    const checkId = stepOfKind(steps, "check").id;
    const first = await shownCheckOrder(lesson.id);

    expect(first).not.toStrictEqual(STORED_CHECK_ORDER);
    expect(first.toSorted()).toStrictEqual(STORED_CHECK_ORDER.toSorted());
    await expect(shownCheckOrder(lesson.id)).resolves.toStrictEqual(first);

    const sittings = [];

    for (const _ of [1, 2]) {
      // oxlint-disable-next-line no-await-in-loop -- One sitting finishes before the next starts.
      const { checked, completed } = await sitThrough({ checkId, lessonId: lesson.id });

      expect(checked).toMatchObject({ result: { isCorrect: true }, status: "checked" });
      expect(completed).toMatchObject({ completion: { correctCount: 1 }, status: "completed" });

      // oxlint-disable-next-line no-await-in-loop -- Read once this sitting has finished.
      sittings.push(await shownCheckOrder(lesson.id));
    }

    for (const order of sittings) {
      expect(order).not.toStrictEqual(STORED_CHECK_ORDER);
      expect(order.toSorted()).toStrictEqual(STORED_CHECK_ORDER.toSorted());
    }

    expect(sittings.some((order) => order.join(",") !== first.join(","))).toBe(true);
  });

  it("lays out a challenge's choices, a choice check and a dialogue's replies for the sitting", async () => {
    const challenge = playableStepContent.challenge;

    const { lesson } = await setupPlayableLesson({
      steps: [
        { content: activityContentFixtures.areaModel, kind: "activity" },
        { content: activityContentFixtures.dialogueSimulator, kind: "activity" },
        { content: challenge, kind: "challenge" },
        "summary",
      ],
    });

    const readLists = async () => {
      const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
      const steps = result?.status === "ready" ? result.lesson.steps : [];

      return steps.flatMap((step) => {
        if (step.kind === "challenge") {
          return step.content.nodes.map((node) => node.choices.map((choice) => choice.id));
        }

        if (step.kind !== "activity") {
          return [];
        }

        const { check } = step.content;

        return step.content.template === "dialogueSimulator"
          ? [step.content.fields.replies.map((reply) => reply.id)]
          : [check.kind === "choice" ? check.options.map((option) => option.id) : []];
      });
    };

    const stored = [
      activityContentFixtures.areaModel.check.options.map((option) => option.id),
      activityContentFixtures.dialogueSimulator.fields.replies.map((reply) => reply.id),
      ...challenge.nodes.map((node) => node.choices.map((choice) => choice.id)),
    ];

    const shown = await readLists();

    expect(shown.map((ids) => ids.toSorted())).toStrictEqual(stored.map((ids) => ids.toSorted()));
    await expect(readLists()).resolves.toStrictEqual(shown);

    const longLists = shown.filter((ids) => ids.length > 2);

    expect(longLists.length).toBeGreaterThan(2);

    expect(
      shown.filter((ids, index) => ids.length > 2 && ids.join(",") === stored[index]?.join(",")),
    ).toStrictEqual([]);
  });

  it("keeps a sitting's order when a review capsule on the lesson ends", async () => {
    const { lesson, user } = await setupPlayableLesson({
      steps: [{ content: FIVE_OPTION_CHECK, kind: "check" }, "summary"],
    });

    const first = await shownCheckOrder(lesson.id);

    await lessonRunFixture({
      endedAt: new Date(),
      kind: "review",
      lessonId: lesson.id,
      lessonKind: CAPSULE_LEDGER_KIND,
      userId: user.id,
    });

    await expect(shownCheckOrder(lesson.id)).resolves.toStrictEqual(first);
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
    const { lesson } = await playableLessonFixture({
      lesson: { estimatedMinutes: 6, targetLanguage: "es" },
      steps: TEACHING_LESSON_STEPS,
    });

    mockSession(null);
    const visitor = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(visitor).toStrictEqual({
      lesson: {
        description: lesson.description,
        estimatedMinutes: 5,
        id: lesson.id,
        language: lesson.language,
        title: lesson.title,
      },
      status: "sessionRequired",
    });

    expect(JSON.stringify(visitor)).not.toContain('"steps"');

    mockGuestSession(randomUUID());
    const guest = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(guest?.lesson.estimatedMinutes).toBe(5);

    expect(guest?.status === "ready" ? guest.lesson.steps.length : 0).toBe(
      TEACHING_LESSON_STEPS.length,
    );
  });

  it("serves the lesson map, saved labels and shape included, and none for a lesson that ends on its own summary or a challenge", async () => {
    const steps = TEACHING_LESSON_STEPS.filter((kind) => kind !== "summary");

    const nested = {
      ideas: [
        { label: "Organism", text: "An organism is one living thing." },
        { label: "Population", text: "A population is one species in one place." },
      ],
      shape: "nested",
    };

    const [saved, labeled, endsOnSummary, unwritten, challenge] = await Promise.all([
      playableLessonFixture({
        lesson: {
          summary: {
            ideas: [{ text: "Electrons live in clouds." }, { text: "Clouds are fuzzy." }],
          },
        },
        steps,
      }),
      playableLessonFixture({ lesson: { summary: nested }, steps }),
      playableLessonFixture({ lesson: { summary: { ideas: [{ text: "A recap." }] } } }),
      playableLessonFixture({ steps }),
      playableLessonFixture({
        lesson: { summary: { ideas: [{ text: "A won case shows the idea." }] } },
        steps: ["challenge"],
      }),
    ]);

    const maps = await Promise.all(
      [saved, labeled, endsOnSummary, unwritten, challenge].map(async (fixture) => {
        const result = await getPlayableLibraryLesson({ lessonId: fixture.lesson.id });
        return result?.status === "ready" ? result.lesson.summary : "not ready";
      }),
    );

    const untagged = { about: null, icon: null };

    expect(maps).toStrictEqual([
      {
        ideas: [
          { ...untagged, text: "Electrons live in clouds." },
          { ...untagged, text: "Clouds are fuzzy." },
        ],
        shape: "hub",
      },
      { ...nested, ideas: nested.ideas.map((idea) => ({ ...idea, ...untagged })) },
      null,
      null,
      null,
    ]);
  });

  it("serves a tagged lesson's marks, about lines and drawn icons", async () => {
    const { icons, lesson } = await markedPlayableLessonFixture();
    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
    const playable = result?.status === "ready" ? result.lesson : null;
    const cloud = { smallUrl: icons.cloud.smallUrl, url: icons.cloud.url };

    expect(playable?.summary?.ideas.map(({ about, icon }) => ({ about, icon }))).toStrictEqual([
      { about: "What the electron does around the nucleus", icon: cloud },
      {
        about: "How to read the cloud",
        icon: { smallUrl: icons.nucleus.smallUrl, url: icons.nucleus.url },
      },
    ]);

    expect(playable?.steps.map((step) => ("marks" in step ? step.marks : "none"))).toStrictEqual([
      { example: null, icon: null, ideaIndex: null, underline: null },
      {
        example: "The electron doesn't circle the nucleus like a planet.",
        icon: { smallUrl: icons.planet.smallUrl, url: icons.planet.url },
        ideaIndex: 0,
        underline: "a map of where it might be",
      },
      { example: null, icon: null, ideaIndex: 1, underline: "darkest just around the nucleus" },
      { example: null, icon: null, ideaIndex: null, underline: null },
    ]);
  });

  it("never shows a screen the icon its idea's strip already shows, even when marks stored it", async () => {
    const { icons, lesson } = await markedPlayableLessonFixture();
    const example = "The electron doesn't circle the nucleus like a planet.";
    const underline = "a map of where it might be";

    await prisma.step.updateMany({
      data: {
        marks: { example, iconId: icons.cloud.id, iconPending: false, ideaIndex: 0, underline },
      },
      where: { kind: "explanation", lessonId: lesson.id },
    });

    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
    const shown = result?.status === "ready" ? result.lesson.steps[1] : null;

    expect(shown && "marks" in shown ? shown.marks : null).toStrictEqual({
      example,
      icon: null,
      ideaIndex: 0,
      underline,
    });
  });

  it("never shows two of the map's ideas one icon, even when the map stored it twice", async () => {
    const { icons, lesson } = await markedPlayableLessonFixture();
    const saved = readSavedLessonMap(lesson.summary);
    const ideas = saved?.ideas.map((idea) => ({ ...idea, iconId: icons.cloud.id }));

    await prisma.lesson.update({
      data: { summary: { ...saved, ideas } },
      where: { id: lesson.id },
    });

    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
    const shown = result?.status === "ready" ? result.lesson.summary?.ideas : [];

    expect(shown?.map((idea) => idea.icon)).toStrictEqual([
      { smallUrl: icons.cloud.smallUrl, url: icons.cloud.url },
      null,
    ]);
  });

  it("sends a question or a guess without its idea, which would name its answer, though tagging stored one", async () => {
    const { lesson } = await markedPlayableLessonFixture();
    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
    const steps = result?.status === "ready" ? result.lesson.steps : [];
    const questions = steps.filter((step) => step.kind === "hook" || step.kind === "check");

    const stored = await prisma.step.findMany({
      orderBy: { position: "asc" },
      select: { marks: true },
      where: { kind: { in: ["hook", "check"] }, lessonId: lesson.id },
    });

    expect(stored.map((step) => readSavedStepMarks(step.marks)?.ideaIndex)).toStrictEqual([0, 1]);

    expect(
      questions.map((step) => ("marks" in step ? step.marks?.ideaIndex : "none")),
    ).toStrictEqual([null, null]);
  });

  it("drops marks the screen can't show: a quote it doesn't have, half a sentence, an idea past the map, an icon beside a picture, an icon not drawn yet", async () => {
    const icon = await lessonIconFixture();
    const drawing = await lessonIconFixture({ smallUrl: null, status: "failed", url: null });
    const text = playableStepContent.explanation.text;

    const marks = {
      example: "doesn't circle the nucleus like a planet.",
      iconId: icon.id,
      iconPending: false,
      ideaIndex: 3,
      underline: "a **cloud of possibilities**",
    };

    const { lesson } = await playableLessonFixture({
      lesson: { summary: { ideas: [{ text: "Electrons live in clouds." }] } },
      steps: [
        { kind: "explanation", marks },
        {
          content: {
            ...playableStepContent.explanation,
            image: { alt: "A fuzzy cloud", prompt: "Electron cloud" },
          },
          kind: "explanation",
          marks: { ...marks, example: text.slice(0, text.indexOf(" It ")), ideaIndex: 0 },
        },
        { kind: "explanation", marks: { ...marks, iconId: drawing.id, underline: "in the text" } },
      ],
    });

    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
    const steps = result?.status === "ready" ? result.lesson.steps : [];

    expect(steps.map((step) => ("marks" in step ? step.marks : "none"))).toStrictEqual([
      {
        example: null,
        icon: { smallUrl: icon.smallUrl, url: icon.url },
        ideaIndex: null,
        underline: null,
      },
      {
        example: "The electron doesn't circle the nucleus like a planet.",
        icon: null,
        ideaIndex: 0,
        underline: null,
      },
      { example: null, icon: null, ideaIndex: null, underline: null },
    ]);
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

  it("keeps the fill-in-the-blank tiles of a lesson that doesn't teach a language silent", async () => {
    const [{ lesson }, organization] = await Promise.all([
      playableLessonFixture({ steps: ["fillBlank"] }),
      organizationFixture(),
    ]);

    await wordFixture({
      audioUrl: "https://audio.zoonk.test/cloud.mp3",
      organizationId: organization.id,
      targetLanguage: lesson.language,
      word: playableStepContent.fillBlank.answers[0],
    });

    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
    const [step] = result?.status === "ready" ? result.lesson.steps : [];
    const tiles = step && "exercise" in step ? step.exercise.fillBlankOptions : [];

    expect(tiles.map((tile) => tile.audioUrl)).toStrictEqual([null, null, null]);
  });

  it("sends each activity's tolerance floor from its template, so apps grade a guess as core does", async () => {
    const { lesson } = await playableLessonFixture({
      steps: [{ content: activityContentFixtures.guessReveal, kind: "activity" }, "activity"],
    });

    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
    const steps = result?.status === "ready" ? result.lesson.steps : [];

    expect(
      steps.map((step) => (step.kind === "activity" ? step.minTolerance : undefined)),
    ).toStrictEqual([{ kind: "relative", value: 0.1 }, null]);
  });

  it("sends each numeric activity's answer rounded to the places its hint names, so every app writes it alike", async () => {
    const { lesson } = await playableLessonFixture({
      steps: [{ content: activityContentFixtures.guessReveal, kind: "activity" }, "activity"],
    });

    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
    const steps = result?.status === "ready" ? result.lesson.steps : [];

    expect(
      steps.map((step) => (step.kind === "activity" ? step.roundedAnswer : undefined)),
    ).toStrictEqual([
      { places: 0, value: 12 },
      { places: null, value: 5 },
    ]);
  });

  it("sends an explanation's explore with its solved end state only when its template checks the end state", async () => {
    const { formulaModel, processOrder } = activityContentFixtures;

    const { lesson } = await playableLessonFixture({
      steps: [
        exploring("processOrder", processOrder.fields),
        exploring("formulaModel", formulaModel.fields),
        "explanation",
      ],
    });

    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
    const steps = result?.status === "ready" ? result.lesson.steps : [];

    expect(
      steps.map((step) => (step.kind === "explanation" ? step.exploreExpected : undefined)),
    ).toStrictEqual([
      {
        answer: { ids: ["absorb", "split", "store", "calvin", "starch"], kind: "order" },
        kind: "interaction",
      },
      undefined,
      undefined,
    ]);
  });

  it("serves language screens with the pair's translation, note, sound tip and word banks", async () => {
    const { lesson, sentence, word } = await languageLessonFixture();

    await prisma.lessonSentence.update({
      data: {
        otherSentenceOrders: ["The rent is how much?"],
        otherTranslationOrders: ["O aluguel é quanto?"],
      },
      where: { lessonId_sentenceId: { lessonId: lesson.id, sentenceId: sentence.id } },
    });

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
    ).toStrictEqual(["bill", "deposit", "rent"]);

    expect(steps[2]).toMatchObject({
      exercise: {
        sentence: {
          otherSentenceOrders: [["The", "rent", "is", "how", "much?"]],
          otherTranslationOrders: [["O", "aluguel", "é", "quanto?"]],
          sentence: "How much is the rent?",
          translation: "Quanto é o aluguel?",
        },
      },
      wordHints: null,
    });

    expect(steps[4]).toMatchObject({
      kind: "spokenAnswer",
      listening: {
        kind: "listening",
        sentence: {
          otherSentenceOrders: [["The", "rent", "is", "how", "much?"]],
          otherTranslationOrders: [["O", "aluguel", "é", "quanto?"]],
          sentence: "How much is the rent?",
          translation: "Quanto é o aluguel?",
        },
      },
    });
  });

  it.each([
    { attempts: 0, expected: false, ordersOwedAt: null },
    { attempts: 0, expected: true, ordersOwedAt: new Date() },
    { attempts: MAX_SENTENCE_ORDERS_ATTEMPTS - 1, expected: true, ordersOwedAt: new Date() },
    { attempts: MAX_SENTENCE_ORDERS_ATTEMPTS, expected: false, ordersOwedAt: new Date() },
    { attempts: MAX_SENTENCE_ORDERS_ATTEMPTS + 1, expected: false, ordersOwedAt: new Date() },
  ])(
    "serves pending orders only while attempts remain (%s)",
    async ({ attempts, expected, ordersOwedAt }) => {
      const { lesson, sentence } = await languageLessonFixture();

      await prisma.lessonSentence.update({
        data: { ordersOwedAt },
        where: { lessonId_sentenceId: { lessonId: lesson.id, sentenceId: sentence.id } },
      });

      await prisma.lesson.update({
        data: { sentenceOrdersAttempts: attempts },
        where: { id: lesson.id },
      });

      const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
      const steps = result?.status === "ready" ? result.lesson.steps : [];

      expect(steps.find((step) => step.kind === "reading")).toMatchObject({
        exercise: { sentence: { ordersPending: expected } },
      });

      expect(steps.find((step) => step.kind === "listening")).toMatchObject({
        exercise: { sentence: { ordersPending: expected } },
      });

      expect(steps.find((step) => step.kind === "spokenAnswer")).toMatchObject({
        listening: { sentence: { ordersPending: expected } },
      });
    },
  );

  it("plays a sentence word that only another lesson saved and voiced", async () => {
    const word = randomUUID();

    const { lesson, sentence } = await languageLessonFixture({
      sentenceText: `How much is ${word}?`,
    });

    const voiced = await wordFixture({
      audioUrl: `https://audio.zoonk.test/${word}.mp3`,
      organizationId: sentence.organizationId,
      targetLanguage: "en",
      word: word.toUpperCase(),
    });

    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
    const steps = result?.status === "ready" ? result.lesson.steps : [];
    const reading = steps.find((step) => step.kind === "reading");
    const tiles = reading && "exercise" in reading ? reading.exercise.wordBankOptions : [];

    expect(tiles.find((tile) => tile.word === `${word}?`)?.audioUrl).toBe(voiced.audioUrl);
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

  it("serves a check's setup picture and reserves a pending picture without one", async () => {
    const image = { alt: "Two atoms sharing a pair of electrons", prompt: "A covalent bond" };
    const asset = await mediaAssetFixture({ height: 1024, width: 1536 });

    const { lesson } = await playableLessonFixture({
      steps: [
        { content: { ...playableStepContent.check, image }, kind: "check", mediaAssetId: asset.id },
        { content: { ...playableStepContent.check, image }, kind: "check" },
      ],
    });

    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });
    const steps = result?.status === "ready" ? result.lesson.steps : [];

    expect(steps[0]).toMatchObject({
      content: { image },
      image: { alt: image.alt, height: 1024, id: asset.id, url: asset.url, width: 1536 },
      imagePending: false,
      kind: "check",
    });

    expect(steps[1]).toMatchObject({
      content: { image },
      image: null,
      imagePending: true,
      kind: "check",
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
  });
});
