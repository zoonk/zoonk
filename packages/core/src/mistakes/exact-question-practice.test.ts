import { gradeTypedAnswer } from "@zoonk/ai/tasks/grading/grade-typed-answer";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { gradeChoiceAnswer, parseChoiceItem } from "../learner/_utils/choice-items";
import { recordLearnerAnswer } from "../learner/record-learner-answer";
import { typedGrade } from "../lesson-player/_test-utils/typed-grade";
import { answerMistakePractice } from "./answer-mistake-practice";
import { finishMistakePractice } from "./finish-mistake-practice";
import { getMistakePractice } from "./get-mistake-practice";

const YESTERDAY = new Date(Date.now() - 86_400_000);

async function setup() {
  const [user, skill, lesson] = await Promise.all([
    userFixture(),
    skillFixture(),
    libraryLessonFixture(),
  ]);

  await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });

  const step = await libraryStepFixture({
    content: {
      basis: null,
      context: "The original passage",
      options: [
        { id: "right", isCorrect: true, reason: "Original reason", text: "Original right" },
        { id: "wrong", isCorrect: false, reason: "Try again", text: "Original wrong" },
      ],
      question: "Which original answer?",
    },
    kind: "check",
    lessonId: lesson.id,
    skillId: skill.id,
  });

  const bank = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

  const mistake = await mistakeFixture({
    createdAt: YESTERDAY,
    skillId: skill.id,
    stepId: step.id,
    userId: user.id,
  });

  mockSession(user.id);
  return { bank, mistake, skill, step, user };
}

async function typedSetup() {
  const fixture = await setup();

  await prisma.step.update({
    data: {
      content: {
        basis: null,
        keyPoints: ["An original idea"],
        question: "Explain the original idea",
        sampleAnswer: "Original sample answer",
      },
      kind: "typedAnswer",
    },
    where: { id: fixture.step.id },
  });

  await prisma.mistake.update({
    data: { snapshot: { answer: "Original wrong", question: "Explain the original idea" } },
    where: { id: fixture.mistake.id },
  });

  const input = {
    answer: { kind: "typedAnswer" as const, text: "My original explanation" },
    attemptId: crypto.randomUUID(),
    durationMs: 8000,
    stepId: fixture.step.id,
  };

  return { ...fixture, input };
}

describe("exact-question practice", () => {
  it("replays the exact lesson question instead of a bank question on its skill", async () => {
    const { mistake, step } = await setup();
    const result = await getMistakePractice({ includeAllFormats: true, timeZone: "UTC" });

    expect(result).toMatchObject({
      practice: [
        {
          lesson: {
            step: {
              content: { context: "The original passage", question: "Which original answer?" },
              id: step.id,
              kind: "check",
            },
          },
          mistakeId: mistake.id,
          questions: [],
        },
      ],
      status: "ready",
    });
  });

  it("rejects a different question without clearing distinct originals on the same skill", async () => {
    const { bank, mistake, skill, user } = await setup();

    const other = await mistakeFixture({
      createdAt: YESTERDAY,
      skillId: skill.id,
      userId: user.id,
    });

    const result = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 2000, itemId: bank.id, timeZone: "UTC" },
      mistakeId: mistake.id,
    });

    expect(result).toStrictEqual({ status: "invalidItem" });

    await expect(
      prisma.mistake.count({ where: { id: { in: [mistake.id, other.id] }, status: "open" } }),
    ).resolves.toBe(2);
  });

  it("fixes only the exact lesson original and records a retry once", async () => {
    const { mistake, skill, step, user } = await setup();

    const otherStep = await libraryStepFixture({
      content: step.content as object,
      kind: "check",
      lessonId: step.lessonId,
      skillId: skill.id,
    });

    const other = await mistakeFixture({
      createdAt: YESTERDAY,
      skillId: skill.id,
      stepId: otherStep.id,
      userId: user.id,
    });

    const input = {
      answer: { kind: "check" as const, optionId: "right" },
      attemptId: crypto.randomUUID(),
      durationMs: 2000,
      run: { answerIds: [] },
      stepId: step.id,
      timeZone: "UTC",
    };

    const first = await answerMistakePractice({ input, mistakeId: mistake.id });
    const retry = await answerMistakePractice({ input, mistakeId: mistake.id });

    expect(first).toMatchObject({
      feedback: {
        fixed: true,
        fixedMistakeIds: [mistake.id],
        lessonResult: { checked: true, isCorrect: true },
      },
      status: "ready",
    });

    expect(retry).toMatchObject(first);

    await expect(prisma.mistake.findUnique({ where: { id: other.id } })).resolves.toMatchObject({
      status: "open",
    });

    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);

    await expect(
      prisma.learningEvent.findMany({ where: { lessonKind: "mistakePractice", userId: user.id } }),
    ).resolves.toHaveLength(1);
  });

  it("keeps today's exact original open even when its answer is correct", async () => {
    const { mistake, step } = await setup();
    await prisma.mistake.update({ data: { createdAt: new Date() }, where: { id: mistake.id } });

    const result = await answerMistakePractice({
      input: {
        answer: { kind: "check", optionId: "right" },
        attemptId: crypto.randomUUID(),
        durationMs: 2000,
        stepId: step.id,
        timeZone: "UTC",
      },
      mistakeId: mistake.id,
    });

    expect(result).toMatchObject({
      feedback: { fixed: false, fixedMistakeIds: [], mistakeStatus: "open" },
      status: "ready",
    });
  });

  it("offers no replacement for missing or retired originals, including their availability", async () => {
    const { bank, mistake, step } = await setup();
    await prisma.step.delete({ where: { id: step.id } });
    const result = await getMistakePractice({ includeAllFormats: true, timeZone: "UTC" });
    expect(result).toMatchObject({ practice: [], status: "ready" });

    await expect(
      answerMistakePractice({
        input: { answer: { selectedIndex: 0 }, durationMs: 2000, itemId: bank.id },
        mistakeId: mistake.id,
      }),
    ).resolves.toStrictEqual({ status: "invalidItem" });
  });

  it("keeps lesson entries out of the legacy bank-only response", async () => {
    await setup();

    await expect(getMistakePractice({ timeZone: "UTC" })).resolves.toMatchObject({
      practice: [],
      status: "ready",
    });
  });

  it("preserves a newly recorded original through source edits and deletion", async () => {
    const { mistake, step, skill, user } = await setup();
    await prisma.mistake.delete({ where: { id: mistake.id } });

    const recorded = await recordLearnerAnswer({
      answer: { kind: "check", optionId: "wrong" },
      graded: { durationMs: 2000, isCorrect: false },
      language: "en",
      mistake: {
        questionText: "The original passage\n\nWhich original answer?",
        snapshot: {
          answer: "Original wrong",
          correctAnswer: "Original right",
          question: "The original passage\n\nWhich original answer?",
        },
      },
      purpose: "learning",
      skillId: skill.id,
      stepId: step.id,
      timeZone: "UTC",
      userId: user.id,
    });

    expect(recorded.mistake).not.toBeNull();
    const savedId = recorded.mistake!.id;
    await prisma.mistake.update({ data: { createdAt: YESTERDAY }, where: { id: savedId } });

    await prisma.step.update({
      data: { content: { ...(step.content as object), question: "Replacement question" } },
      where: { id: step.id },
    });

    const beforeDeletion = await getMistakePractice({ includeAllFormats: true, timeZone: "UTC" });

    expect(beforeDeletion).toMatchObject({
      practice: [{ lesson: { step: { content: { question: "Which original answer?" } } } }],
    });

    await prisma.step.delete({ where: { id: step.id } });
    const afterDeletion = await getMistakePractice({ includeAllFormats: true, timeZone: "UTC" });

    expect(afterDeletion).toMatchObject({
      practice: [
        { lesson: { step: { content: { question: "Which original answer?" }, id: step.id } } },
      ],
    });

    const result = await answerMistakePractice({
      input: {
        answer: { kind: "check", optionId: "right" },
        attemptId: crypto.randomUUID(),
        durationMs: 2000,
        stepId: step.id,
      },
      mistakeId: savedId,
    });

    expect(result).toMatchObject({
      feedback: { fixed: true, fixedMistakeIds: [savedId] },
      status: "ready",
    });

    expect(
      afterDeletion.status === "ready" && afterDeletion.practice[0]?.snapshot,
    ).not.toHaveProperty("replay");
  });

  it("never replays an explicitly retired bank question, even with its preserved payload", async () => {
    const { bank, mistake } = await setup();
    const parsed = parseChoiceItem(bank)!;
    const snapshot = gradeChoiceAnswer({ answer: { selectedIndex: 1 }, item: parsed }).snapshot;

    await prisma.mistake.update({
      data: {
        itemId: bank.id,
        snapshot: { ...snapshot, replay: { item: parsed, kind: "item" } },
        stepId: null,
      },
      where: { id: mistake.id },
    });

    await prisma.item.update({ data: { retiredAt: new Date() }, where: { id: bank.id } });

    await expect(
      getMistakePractice({ includeAllFormats: true, timeZone: "UTC" }),
    ).resolves.toMatchObject({ practice: [], status: "ready" });

    await expect(
      answerMistakePractice({
        input: { answer: { selectedIndex: 0 }, durationMs: 2000, itemId: bank.id },
        mistakeId: mistake.id,
      }),
    ).resolves.toStrictEqual({ status: "invalidItem" });
  });

  it("admits one concurrent model grade and reuses its full saved verdict on retries", async () => {
    const { input, mistake, step, user } = await typedSetup();
    const entered = Promise.withResolvers<null>();
    const released = Promise.withResolvers<null>();

    vi.mocked(gradeTypedAnswer).mockImplementationOnce(async () => {
      entered.resolve(null);
      await released.promise;
      return typedGrade({ feedback: "Exact saved feedback", isCorrect: true, score: 1 });
    });

    const first = answerMistakePractice({ input, mistakeId: mistake.id });
    await entered.promise;
    const simultaneous = await answerMistakePractice({ input, mistakeId: mistake.id });
    expect(simultaneous).toStrictEqual({ status: "retryable" });
    released.resolve(null);
    const result = await first;
    const retry = await answerMistakePractice({ input, mistakeId: mistake.id });
    expect(retry).toMatchObject(result);

    expect(retry).toMatchObject({
      feedback: {
        lessonResult: { checked: true, feedback: "Exact saved feedback", isCorrect: true },
      },
      status: "ready",
    });

    expect(gradeTypedAnswer).toHaveBeenCalledOnce();

    await expect(
      prisma.modelGrade.count({ where: { questionId: step.id, userId: user.id } }),
    ).resolves.toBe(1);

    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("releases a failed grading owner and retries under its original spend claim", async () => {
    const { input, mistake, step, user } = await typedSetup();
    vi.mocked(gradeTypedAnswer).mockRejectedValueOnce(new Error("provider temporarily failed"));

    await expect(answerMistakePractice({ input, mistakeId: mistake.id })).rejects.toThrow(
      "provider temporarily failed",
    );

    vi.mocked(gradeTypedAnswer).mockResolvedValueOnce(
      typedGrade({ feedback: "Recovered", isCorrect: false, score: 0 }),
    );

    await expect(answerMistakePractice({ input, mistakeId: mistake.id })).resolves.toMatchObject({
      feedback: { lessonResult: { checked: true, feedback: "Recovered" } },
      status: "ready",
    });

    await expect(
      prisma.modelGrade.count({ where: { questionId: step.id, userId: user.id } }),
    ).resolves.toBe(1);

    await expect(prisma.testSubmissionClaim.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("returns unchecked feedback without fixing or counting an over-cap typed answer", async () => {
    const { input, mistake, step, user } = await typedSetup();

    await prisma.modelGrade.createMany({
      data: Array.from({ length: 5 }, () => ({ questionId: step.id, userId: user.id })),
    });

    const result = await answerMistakePractice({
      input: { ...input, run: { answerIds: [] } },
      mistakeId: mistake.id,
    });

    expect(result).toMatchObject({
      feedback: {
        answerId: null,
        fixed: false,
        fixedMistakeIds: [],
        lessonResult: { checked: false, correctAnswer: "Original sample answer" },
      },
      status: "ready",
    });

    await expect(
      prisma.modelGrade.count({ where: { questionId: step.id, userId: user.id } }),
    ).resolves.toBe(5);

    expect(gradeTypedAnswer).not.toHaveBeenCalled();
    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.learningEvent.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("does not fix a preserved original through a rewritten question with the same source id", async () => {
    const { bank, user, skill } = await setup();
    const original = parseChoiceItem(bank);

    if (!original) {
      throw new Error("The original must be playable");
    }

    const wrong = gradeChoiceAnswer({ answer: { selectedIndex: 1 }, item: original });

    const recorded = await recordLearnerAnswer({
      answer: { selectedIndex: 1 },
      graded: { durationMs: 2000, isCorrect: false },
      itemId: bank.id,
      language: "en",
      mistake: { questionText: wrong.snapshot.question, snapshot: wrong.snapshot },
      purpose: "learning",
      skillId: skill.id,
      timeZone: "UTC",
      userId: user.id,
    });

    if (!recorded.mistake) {
      throw new Error("The wrong answer must save a mistake");
    }

    await prisma.mistake.update({
      data: { createdAt: YESTERDAY },
      where: { id: recorded.mistake.id },
    });

    const rewritten = await prisma.item.update({
      data: { content: { ...original.content, question: "A different replacement question?" } },
      where: { id: bank.id },
    });

    const current = parseChoiceItem(rewritten);

    if (!current) {
      throw new Error("The replacement must be playable");
    }

    const correct = gradeChoiceAnswer({ answer: { selectedIndex: 0 }, item: current });

    const answered = await recordLearnerAnswer({
      answer: { selectedIndex: 0 },
      graded: { durationMs: 2000, isCorrect: true },
      itemId: bank.id,
      language: "en",
      mistake: { questionText: correct.snapshot.question, snapshot: correct.snapshot },
      purpose: "learning",
      skillId: skill.id,
      timeZone: "UTC",
      userId: user.id,
    });

    expect(answered.fixedMistakeIds).toStrictEqual([]);

    await expect(
      prisma.mistake.findUnique({ where: { id: recorded.mistake.id } }),
    ).resolves.toMatchObject({ status: "open" });

    await expect(
      answerMistakePractice({
        input: { answer: { selectedIndex: 0 }, durationMs: 2000, itemId: bank.id },
        mistakeId: recorded.mistake.id,
      }),
    ).resolves.toMatchObject({ feedback: { fixed: true }, status: "ready" });
  });

  it("settles the notebook mission from an exact lesson correction", async () => {
    const { mistake, step, user } = await setup();
    const goal = await goalFixture({ timezone: "UTC", userId: user.id });

    await studySessionFixture({
      goalId: goal.id,
      localDate: new Date(new Date().toISOString().slice(0, 10)),
      missions: { picks: [{ anchor: {}, kind: "fixMistake", total: 1 }], version: 1 },
      userId: user.id,
    });

    const answered = await answerMistakePractice({
      input: {
        answer: { kind: "check", optionId: "right" },
        attemptId: crypto.randomUUID(),
        durationMs: 2000,
        stepId: step.id,
        timeZone: "UTC",
      },
      mistakeId: mistake.id,
    });

    if (answered.status !== "ready" || !answered.feedback.answerId) {
      throw new Error("The exact answer must be recorded");
    }

    await expect(
      finishMistakePractice({
        answerIds: [answered.feedback.answerId],
        ended: true,
        timeZone: "UTC",
      }),
    ).resolves.toMatchObject({
      result: { missionMoment: { completed: ["fixMistake"] } },
      status: "ready",
    });
  });

  it("records a new wrong recurrence after an exact original was fixed, and retries it once", async () => {
    const { mistake, step, user } = await setup();

    const right = await answerMistakePractice({
      input: {
        answer: { kind: "check", optionId: "right" },
        attemptId: crypto.randomUUID(),
        durationMs: 2000,
        stepId: step.id,
        timeZone: "UTC",
      },
      mistakeId: mistake.id,
    });

    expect(right).toMatchObject({ feedback: { fixed: true }, status: "ready" });

    const input = {
      answer: { kind: "check" as const, optionId: "wrong" },
      attemptId: crypto.randomUUID(),
      durationMs: 2000,
      stepId: step.id,
      timeZone: "UTC",
    };

    await answerMistakePractice({ input, mistakeId: mistake.id });
    await answerMistakePractice({ input, mistakeId: mistake.id });
    const open = await prisma.mistake.findMany({ where: { status: "open", userId: user.id } });
    expect(open).toHaveLength(1);
    expect(open[0]?.id).not.toBe(mistake.id);
    expect(open[0]?.createdAt.getTime()).toBeGreaterThan(YESTERDAY.getTime());

    await expect(
      getMistakePractice({ includeAllFormats: true, timeZone: "UTC" }),
    ).resolves.toMatchObject({ practice: [], status: "ready" });

    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(2);
  });

  it("restores the original lesson variant rather than the learner's current variant", async () => {
    const { mistake, step } = await setup();

    await stepVariantFixture({
      content: { ...(step.content as object), question: "The original nursing question?" },
      key: "nursing",
      kind: "field",
      stepId: step.id,
    });

    await prisma.mistake.update({
      data: {
        snapshot: {
          answer: "Original wrong",
          correctAnswer: "Original right",
          question: "The original passage\n\nThe original nursing question?",
        },
      },
      where: { id: mistake.id },
    });

    await expect(
      getMistakePractice({ includeAllFormats: true, timeZone: "UTC" }),
    ).resolves.toMatchObject({
      practice: [
        {
          lesson: {
            step: { content: { question: "The original nursing question?" }, id: step.id },
          },
        },
      ],
      status: "ready",
    });
  });

  it("refuses a legacy source whose original question can no longer be recovered", async () => {
    const { mistake, step } = await setup();

    await prisma.step.update({
      data: {
        content: { ...(step.content as object), question: "A different replacement question?" },
      },
      where: { id: step.id },
    });

    await expect(
      getMistakePractice({ includeAllFormats: true, timeZone: "UTC" }),
    ).resolves.toMatchObject({ practice: [], status: "ready" });

    await expect(
      answerMistakePractice({
        input: {
          answer: { kind: "check", optionId: "right" },
          attemptId: crypto.randomUUID(),
          durationMs: 2000,
          stepId: step.id,
        },
        mistakeId: mistake.id,
      }),
    ).resolves.toStrictEqual({ status: "invalidItem" });

    await expect(prisma.mistake.findUnique({ where: { id: mistake.id } })).resolves.toMatchObject({
      status: "open",
    });
  });

  it("rejects a mismatched typed lesson answer before claiming model budget", async () => {
    const { input, mistake, step, user } = await typedSetup();

    await expect(
      answerMistakePractice({
        input: { ...input, answer: { kind: "check", optionId: "right" } },
        mistakeId: mistake.id,
      }),
    ).resolves.toStrictEqual({ status: "invalidItem" });

    expect(gradeTypedAnswer).not.toHaveBeenCalled();

    await expect(
      prisma.modelGrade.count({ where: { questionId: step.id, userId: user.id } }),
    ).resolves.toBe(0);
  });
});
