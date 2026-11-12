import { classifyMistakeCause } from "@zoonk/ai/tasks/mistakes/cause";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import {
  choiceItemContent,
  itemFixture,
  itemSetFixture,
  skillFixture,
  textSetContent,
} from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { listFollowUps } from "../follow-ups/follow-up-rows";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { gradeChoiceAnswer, parseChoiceItem } from "../learner/_utils/choice-items";
import { recordLearnerAnswer } from "../learner/record-learner-answer";
import { answerMistakePractice } from "./answer-mistake-practice";
import { MAX_PRACTICE_ANSWERS } from "./contract";
import { getMistakePractice } from "./get-mistake-practice";
import { loadMistakePracticeAvailability } from "./mistake-availability";
import { resolveMistakeCause } from "./resolve-mistake-cause";

const deferred: Promise<unknown>[] = [];
const YESTERDAY = new Date(Date.now() - 86_400_000);

async function setup() {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

  const [original, extra, lesson] = await Promise.all([
    itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    libraryLessonFixture(),
  ]);

  await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });
  mockSession(user.id);

  return { extra, lesson, original, skill, user };
}

describe(getMistakePractice, () => {
  it("keeps the saved context and visual beside a practice after the live question changes", async () => {
    const { original, skill, user } = await setup();
    const context = "A tree casts a 12 m shadow while a 2 m post casts a 3 m shadow.";

    const visual = {
      events: [
        { date: "09:00", detail: null, label: "Measure the post" },
        { date: "09:05", detail: null, label: "Measure the tree" },
      ],
      kind: "timeline",
      title: "Shadow measurements",
    };

    const parsed = parseChoiceItem(original);

    if (!parsed || parsed.format !== "multipleChoice") {
      throw new Error("The original must be a choice question");
    }

    const replay = {
      item: {
        ...parsed,
        content: { ...parsed.content, context, question: "What is the tree's height?", visual },
      },
      kind: "item" as const,
    };

    await mistakeFixture({
      cause: "gap",
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      snapshot: {
        answer: "Wrong answer",
        context,
        question: "What is the tree's height?",
        replay,
        visual,
      },
      userId: user.id,
    });

    const result = await getMistakePractice({ timeZone: "UTC" });

    expect(result.status === "ready" && result.practice[0]?.snapshot).toMatchObject({
      context,
      visual,
    });

    expect(result.status === "ready" && result.practice[0]?.questions[0]?.context).toBe(context);
  });

  it("builds a drill per mistake from earlier days, with its own question", async () => {
    freezeClock();

    const { extra, lesson, original, skill, user } = await setup();

    const [mistake] = await Promise.all([
      mistakeFixture({
        cause: "gap",
        createdAt: YESTERDAY,
        itemId: original.id,
        skillId: skill.id,
        userId: user.id,
      }),
      mistakeFixture({
        cause: "trap",
        createdAt: new Date(),
        itemId: extra.id,
        skillId: skill.id,
        userId: user.id,
      }),
    ]);

    const result = await getMistakePractice({ timeZone: "UTC" });

    expect(result.status === "ready" && result.practice).toHaveLength(1);

    expect(result.status === "ready" && result.practice[0]).toMatchObject({
      cause: "gap",
      drill: {
        kind: "reteach",
        lesson: { id: lesson.id, ideas: [], title: lesson.title },
        timeLimitSeconds: null,
      },
      mistakeId: mistake.id,
    });

    expect(
      result.status === "ready" && result.practice[0]?.questions.map((question) => question.itemId),
    ).toStrictEqual([original.id]);

    expect(JSON.stringify(result)).not.toContain("isCorrect");
  });

  it("shows the picture of a question about a figure, with the writer's alt text", async () => {
    const { skill, user } = await setup();
    const picture = await mediaAssetFixture({ height: 1024, width: 1536 });

    const image = {
      alt: "A circuit with two resistors in series.",
      prompt: "Two resistors in series",
    };

    const pictured = await itemFixture({
      content: { ...choiceItemContent("Which resistor gets more voltage?"), image },
      mediaAssetId: picture.id,
      skillId: skill.id,
    });

    await mistakeFixture({
      cause: "gap",
      createdAt: YESTERDAY,
      itemId: pictured.id,
      skillId: skill.id,
      userId: user.id,
    });

    const result = await getMistakePractice({ timeZone: "UTC" });
    const questions = result.status === "ready" ? (result.practice[0]?.questions ?? []) : [];

    expect(questions.map((question) => [question.itemId, question.image])).toStrictEqual([
      [pictured.id, { alt: image.alt, height: 1024, url: picture.url, width: 1536 }],
    ]);
  });

  it("brings a passage question's mistake back with its passage, and only that question of it", async () => {
    const { skill, user } = await setup();
    const passage = textSetContent("The Sunday library");
    const set = await itemSetFixture({ content: passage });

    const [, missed] = await Promise.all([
      itemFixture({
        content: choiceItemContent(),
        setId: set.id,
        setPosition: 0,
        skillId: skill.id,
      }),
      itemFixture({
        content: choiceItemContent(),
        setId: set.id,
        setPosition: 1,
        skillId: skill.id,
      }),
    ]);

    await mistakeFixture({
      cause: "gap",
      createdAt: YESTERDAY,
      itemId: missed?.id,
      skillId: skill.id,
      userId: user.id,
    });

    const result = await getMistakePractice({ timeZone: "UTC" });
    const questions = result.status === "ready" ? (result.practice[0]?.questions ?? []) : [];

    expect(
      questions.map((question) => [question.itemId, question.set?.text ?? null]),
    ).toStrictEqual([[missed?.id, passage.text]]);

    expect(questions[0]?.set).toMatchObject({ count: 2, position: 1, title: "The Sunday library" });
  });

  it("keeps a passage question for its own mistake's drill, never another mistake's", async () => {
    const { original, skill, user } = await setup();
    const set = await itemSetFixture({ content: textSetContent("The Sunday library") });

    const missed = await itemFixture({
      content: choiceItemContent(),
      setId: set.id,
      setPosition: 0,
      skillId: skill.id,
    });

    const [passageMistake, plainMistake] = await Promise.all([
      mistakeFixture({
        cause: "gap",
        createdAt: YESTERDAY,
        itemId: missed.id,
        skillId: skill.id,
        userId: user.id,
      }),
      mistakeFixture({
        cause: "gap",
        createdAt: YESTERDAY,
        itemId: original.id,
        skillId: skill.id,
        userId: user.id,
      }),
    ]);

    const result = await getMistakePractice({ timeZone: "UTC" });
    const practice = result.status === "ready" ? result.practice : [];

    const questionsOf = (mistakeId: string) =>
      practice
        .find((entry) => entry.mistakeId === mistakeId)
        ?.questions.map((question) => question.itemId);

    expect(questionsOf(passageMistake.id)).toStrictEqual([missed.id]);
    expect(questionsOf(plainMistake.id)).toStrictEqual([original.id]);
  });

  it("goes over a lesson the learner can open, with its summary, before a gap's questions", async () => {
    const { original, skill, user } = await setup();
    const owner = await userFixture();

    const [hidden, shared] = await Promise.all([
      libraryLessonFixture({ ownerId: owner.id, visibility: "private" }),
      libraryLessonFixture({ summary: { ideas: [{ text: "Series resistors add up." }] } }),
    ]);

    await prisma.lessonSkill.deleteMany({ where: { skillId: skill.id } });
    await lessonSkillFixture({ lessonId: hidden.id, skillId: skill.id });
    await lessonSkillFixture({ lessonId: shared.id, skillId: skill.id });

    await mistakeFixture({
      cause: "gap",
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    const result = await getMistakePractice({ timeZone: "UTC" });

    expect(result.status === "ready" && result.practice[0]?.drill.lesson).toStrictEqual({
      id: shared.id,
      ideas: ["Series resistors add up."],
      title: shared.title,
    });
  });

  it("practices one skill's mistakes, only from the goal's skills", async () => {
    const { original, skill, user } = await setup();
    const { goal, skills } = await learnerGoalFixture({ phases: [1], userId: user.id });
    const [goalSkill] = skills as [(typeof skills)[number]];
    const goalItem = await itemFixture({ content: choiceItemContent(), skillId: goalSkill.id });

    const [inSkill] = await Promise.all([
      mistakeFixture({
        cause: "trap",
        createdAt: YESTERDAY,
        itemId: goalItem.id,
        skillId: goalSkill.id,
        userId: user.id,
      }),
      mistakeFixture({
        cause: "trap",
        createdAt: YESTERDAY,
        itemId: original.id,
        skillId: skill.id,
        userId: user.id,
      }),
    ]);

    const [practiced, outsideGoal] = await Promise.all([
      getMistakePractice({ goalId: goal.id, skillId: goalSkill.id, timeZone: "UTC" }),
      getMistakePractice({ goalId: goal.id, skillId: skill.id, timeZone: "UTC" }),
    ]);

    expect(
      practiced.status === "ready" && practiced.practice.map((entry) => entry.mistakeId),
    ).toStrictEqual([inSkill.id]);

    expect(outsideGoal.status === "ready" && outsideGoal.practice).toStrictEqual([]);
  });

  it("brings every ready mistake with its own question, past the old limit of five", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    mockSession(user.id);

    const mistakes = await Promise.all(
      Array.from({ length: 7 }, async () => {
        const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

        return mistakeFixture({
          cause: "gap",
          createdAt: YESTERDAY,
          itemId: item.id,
          skillId: skill.id,
          userId: user.id,
        });
      }),
    );

    const result = await getMistakePractice({ timeZone: "UTC" });
    const practice = result.status === "ready" ? result.practice : [];

    const asked = (mistakeId: string) =>
      practice
        .find((entry) => entry.mistakeId === mistakeId)
        ?.questions.map((question) => question.itemId);

    expect(practice).toHaveLength(mistakes.length);

    expect(mistakes.map((mistake) => asked(mistake.id))).toStrictEqual(
      mistakes.map((mistake) => [mistake.itemId]),
    );
  });

  it("stops a run at what its answers can hold, leaving the rest for the next", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    mockSession(user.id);

    await Promise.all(
      Array.from({ length: MAX_PRACTICE_ANSWERS + 1 }, async () => {
        const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

        return mistakeFixture({
          createdAt: YESTERDAY,
          itemId: item.id,
          skillId: skill.id,
          userId: user.id,
        });
      }),
    );

    const result = await getMistakePractice({ timeZone: "UTC" });

    expect(result.status === "ready" && result.practice).toHaveLength(MAX_PRACTICE_ANSWERS);
  });

  it("times each question of a drill for a mistake made by running out of time", async () => {
    const { original, skill, user } = await setup();

    await mistakeFixture({
      cause: "time",
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    const result = await getMistakePractice({ timeZone: "UTC" });

    expect(result.status === "ready" && result.practice[0]?.drill).toStrictEqual({
      kind: "timed",
      lesson: null,
      timeLimitSeconds: 45,
    });
  });
});

describe(answerMistakePractice, () => {
  beforeEach(() => {
    deferred.length = 0;

    vi.mocked(after).mockImplementation((task) => {
      deferred.push(typeof task === "function" ? Promise.resolve(task()) : task);
    });
  });

  it("keeps a don't-know practice open as a gap without inventing a trap", async () => {
    const { original, skill, user } = await setup();

    const mistake = await mistakeFixture({
      cause: "trap",
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    await learnerSkillFixture({ skillId: skill.id, state: "solid", userId: user.id });

    const result = await answerMistakePractice({
      input: { answer: { dontKnow: true }, durationMs: 100, itemId: original.id, timeZone: "UTC" },
      mistakeId: mistake.id,
    });

    expect(result).toMatchObject({
      feedback: { fixed: false, isCorrect: false, mistakeStatus: "open", trap: null },
      status: "ready",
    });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
    ).resolves.toMatchObject({ cause: "gap", fixedAt: null, status: "open" });

    expect(classifyMistakeCause).not.toHaveBeenCalled();
  });

  it("gives a later answer to a fixed mistake the answer that fixed it, without counting it again", async () => {
    const { extra, skill, user } = await setup();

    const mistake = await mistakeFixture({
      createdAt: YESTERDAY,
      itemId: extra.id,
      skillId: skill.id,
      userId: user.id,
    });

    const first = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: extra.id },
      mistakeId: mistake.id,
    });

    const next = await answerMistakePractice({
      input: { answer: { selectedIndex: 1 }, durationMs: 9000, itemId: extra.id },
      mistakeId: mistake.id,
    });

    expect(first).toMatchObject({ feedback: { fixed: true, mistakeStatus: "fixed" } });
    expect(next).toStrictEqual(first);

    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("records one answer when the same mistake is answered at once from two screens", async () => {
    const { extra, skill, user } = await setup();

    const mistake = await mistakeFixture({
      createdAt: YESTERDAY,
      itemId: extra.id,
      skillId: skill.id,
      userId: user.id,
    });

    const results = await Promise.all(
      [0, 1, 0].map((selectedIndex) =>
        answerMistakePractice({
          input: {
            answer: { selectedIndex },
            attemptId: crypto.randomUUID(),
            durationMs: 9000,
            itemId: extra.id,
          },
          mistakeId: mistake.id,
        }),
      ),
    );

    const answerIds = results.flatMap((result) =>
      result.status === "ready" ? [result.feedback.answerId] : [],
    );

    expect(new Set(answerIds).size).toBe(1);
    expect(results.every((result) => ["ready", "retryable"].includes(result.status))).toBe(true);

    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("keeps a mistake missed in practice for another day, so it can't be fixed by repeating the answer just shown", async () => {
    const { original, skill, user } = await setup();

    const mistake = await mistakeFixture({
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    const missed = await answerMistakePractice({
      input: { answer: { selectedIndex: 1 }, durationMs: 9000, itemId: original.id },
      mistakeId: mistake.id,
    });

    expect(missed).toMatchObject({ feedback: { isCorrect: false, mistakeStatus: "open" } });

    const again = await getMistakePractice({ timeZone: "UTC" });
    expect(again).toMatchObject({ practice: [], status: "ready" });

    await expect(
      loadMistakePracticeAvailability({
        localDate: getDateInTimeZone({ date: new Date(), timeZone: "UTC" }),
        timeZone: "UTC",
        userId: user.id,
      }),
    ).resolves.toMatchObject({ availability: { ready: 0, tomorrow: 1 } });

    const repeated = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: original.id },
      mistakeId: mistake.id,
    });

    expect(repeated).toStrictEqual(missed);

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
    ).resolves.toMatchObject({ status: "open" });
  });

  it("counts the practice day in the learner's stored zone for the run and its answers alike", async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-11-11T01:00:00Z"));

    const { original, skill, user } = await setup();
    const goal = await goalFixture({ timezone: "America/Sao_Paulo", userId: user.id });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    const mistake = await mistakeFixture({
      createdAt: new Date("2026-11-10T12:00:00Z"),
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    await expect(getMistakePractice({ timeZone: "UTC" })).resolves.toMatchObject({ practice: [] });

    await expect(
      answerMistakePractice({
        input: {
          answer: { selectedIndex: 0 },
          durationMs: 9000,
          itemId: original.id,
          timeZone: "UTC",
        },
        mistakeId: mistake.id,
      }),
    ).resolves.toStrictEqual({ status: "invalidItem" });

    vi.setSystemTime(new Date("2026-11-11T03:30:00Z"));

    await expect(getMistakePractice({ timeZone: "UTC" })).resolves.toMatchObject({
      practice: [{ mistakeId: mistake.id }],
    });
  });

  it("keeps a mistake missed again in a lesson for another day", async () => {
    const { original, skill, user } = await setup();

    const mistake = await mistakeFixture({
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    const parsed = parseChoiceItem(original);

    if (!parsed) {
      throw new Error("The original must be playable");
    }

    const graded = gradeChoiceAnswer({ answer: { selectedIndex: 1 }, item: parsed });

    const missed = await recordLearnerAnswer({
      answer: { selectedIndex: 1 },
      graded: { durationMs: 9000, isCorrect: false },
      itemId: original.id,
      language: "en",
      mistake: { questionText: graded.snapshot.question, snapshot: graded.snapshot },
      purpose: "learning",
      skillId: skill.id,
      timeZone: "UTC",
      userId: user.id,
    });

    expect(missed.mistake).toMatchObject({ id: mistake.id });

    const gradedRight = gradeChoiceAnswer({ answer: { selectedIndex: 0 }, item: parsed });

    const right = await recordLearnerAnswer({
      answer: { selectedIndex: 0 },
      graded: { durationMs: 9000, isCorrect: true },
      itemId: original.id,
      language: "en",
      mistake: { questionText: gradedRight.snapshot.question, snapshot: gradedRight.snapshot },
      purpose: "learning",
      skillId: skill.id,
      timeZone: "UTC",
      userId: user.id,
    });

    expect(right.fixedMistakeIds).toStrictEqual([]);
    await expect(getMistakePractice({ timeZone: "UTC" })).resolves.toMatchObject({ practice: [] });
  });

  it("fixes a mistake answered right on a later day", async () => {
    const { original, skill, user } = await setup();

    const mistake = await mistakeFixture({
      createdAt: YESTERDAY,
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    const result = await answerMistakePractice({
      input: {
        answer: { selectedIndex: 0 },
        durationMs: 9000,
        itemId: original.id,
        timeZone: "UTC",
      },
      mistakeId: mistake.id,
    });

    expect(result).toStrictEqual({
      feedback: {
        answerId: expect.any(String),
        correctAnswer: { selectedIndex: 0 },
        explanation: "It follows the rule.",
        fixed: true,
        fixedMistakeIds: [mistake.id],
        isCorrect: true,
        lessonResult: null,
        mistakeStatus: "fixed",
        reached: { energy: null, level: null },
        trap: null,
        workedSteps: [],
      },
      status: "ready",
    });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
    ).resolves.toMatchObject({ status: "fixed" });
  });

  it("owes an ambiguous cause's naming by the classifier", async () => {
    const { extra, skill, user } = await setup();

    await mistakeFixture({
      createdAt: YESTERDAY,
      fixedAt: YESTERDAY,
      itemId: extra.id,
      skillId: skill.id,
      status: "fixed",
      userId: user.id,
    });

    await learnerSkillFixture({
      difficulty: 5,
      lastReviewedAt: YESTERDAY,
      reps: 4,
      skillId: skill.id,
      stability: 3,
      state: "learning",
      userId: user.id,
    });

    await Promise.all(
      [true, false, true, true].map((isCorrect, index) =>
        prisma.attempt.create({
          data: {
            answer: {},
            durationMs: 9000,
            hour: 10,
            isCorrect,
            localDate: new Date("2026-09-01"),
            skillId: skill.id,
            userId: user.id,
            weekday: index,
          },
        }),
      ),
    );

    vi.mocked(classifyMistakeCause).mockResolvedValue({
      data: { cause: "trap" },
      provenance: {} as never,
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    });

    const parsed = parseChoiceItem(extra);
    expect(parsed).not.toBeNull();

    if (!parsed) {
      throw new Error("The original must be playable");
    }

    const graded = gradeChoiceAnswer({ answer: { selectedIndex: 1 }, item: parsed });

    const result = await recordLearnerAnswer({
      answer: { selectedIndex: 1 },
      graded: { durationMs: 9000, isCorrect: false },
      itemId: extra.id,
      language: "en",
      mistake: { questionText: graded.snapshot.question, snapshot: graded.snapshot },
      purpose: "learning",
      skillId: skill.id,
      timeZone: "UTC",
      userId: user.id,
    });

    expect(result.mistake).toMatchObject({ status: "open" });

    const added = await prisma.mistake.findFirstOrThrow({
      where: { itemId: extra.id, status: "open", userId: user.id },
    });

    const [owed] = await listFollowUps(user.id);

    expect(owed).toMatchObject({
      input: {
        cause: { learnerAnswer: "Wrong answer", misconception: "Applies the rule backwards" },
        mistakeId: added.id,
      },
      kind: "classifyMistakeCause",
    });

    if (owed?.kind === "classifyMistakeCause") {
      await resolveMistakeCause({ ...owed.input, userId: user.id });
    }

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: added.id } }),
    ).resolves.toMatchObject({ cause: "trap" });
  });

  it("counts an answer that takes a timed drill's whole time box as wrong, run out of time", async () => {
    const { extra, skill, user } = await setup();

    const mistake = await mistakeFixture({
      cause: "time",
      createdAt: YESTERDAY,
      itemId: extra.id,
      skillId: skill.id,
      userId: user.id,
    });

    const late = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 45_000, itemId: extra.id },
      mistakeId: mistake.id,
    });

    expect(late.status === "ready" && late.feedback).toMatchObject({
      isCorrect: false,
      mistakeStatus: "open",
    });

    await answerMistakePractice({
      input: { answer: { dontKnow: true }, durationMs: 45_000, itemId: extra.id },
      mistakeId: mistake.id,
    });

    await expect(
      prisma.mistake.findFirstOrThrow({ where: { itemId: extra.id, userId: user.id } }),
    ).resolves.toMatchObject({ cause: "time" });
  });

  it("names only the trap matching a wrong answer in a trap drill", async () => {
    const { extra, original, skill, user } = await setup();

    const trapMistake = (itemId: string) =>
      mistakeFixture({
        cause: "trap",
        createdAt: YESTERDAY,
        itemId,
        skillId: skill.id,
        userId: user.id,
      });

    const [rightMistake, wrongMistake] = await Promise.all([
      trapMistake(extra.id),
      trapMistake(original.id),
    ]);

    const right = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: extra.id },
      mistakeId: rightMistake.id,
    });

    const wrong = await answerMistakePractice({
      input: { answer: { selectedIndex: 1 }, durationMs: 9000, itemId: original.id },
      mistakeId: wrongMistake.id,
    });

    expect(right.status === "ready" && right.feedback.trap).toBeNull();
    expect(wrong.status === "ready" && wrong.feedback.trap).toBe("Applies the rule backwards");
  });

  it("does not borrow a different wrong option's trap during practice", async () => {
    const { skill, user } = await setup();
    const content = choiceItemContent();

    const unmatched = await itemFixture({
      content: {
        ...content,
        options: [
          ...content.options,
          { isCorrect: false, misconception: null, reason: "A different mistake.", text: "Other" },
        ],
      },
      skillId: skill.id,
    });

    const mistake = await mistakeFixture({
      cause: "trap",
      createdAt: YESTERDAY,
      itemId: unmatched.id,
      skillId: skill.id,
      userId: user.id,
    });

    const result = await answerMistakePractice({
      input: { answer: { selectedIndex: 2 }, durationMs: 100, itemId: unmatched.id },
      mistakeId: mistake.id,
    });

    expect(result).toMatchObject({ feedback: { isCorrect: false, trap: null }, status: "ready" });

    await expect(
      prisma.attempt.findFirstOrThrow({ where: { itemId: unmatched.id, userId: user.id } }),
    ).resolves.toMatchObject({ isCorrect: false });
  });

  it("only accepts questions on the mistake's skill", async () => {
    const { original, skill, user } = await setup();

    const mistake = await mistakeFixture({
      itemId: original.id,
      skillId: skill.id,
      userId: user.id,
    });

    const otherSkill = await skillFixture();
    const otherItem = await itemFixture({ content: choiceItemContent(), skillId: otherSkill.id });

    const result = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: otherItem.id },
      mistakeId: mistake.id,
    });

    expect(result).toStrictEqual({ status: "invalidItem" });
  });

  it("hides another learner's mistake", async () => {
    const { original, skill } = await setup();
    const other = await userFixture();

    const mistake = await mistakeFixture({
      itemId: original.id,
      skillId: skill.id,
      userId: other.id,
    });

    const result = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 9000, itemId: original.id },
      mistakeId: mistake.id,
    });

    expect(result).toStrictEqual({ status: "notFound" });
  });
});
