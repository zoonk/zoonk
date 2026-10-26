import { prisma } from "@zoonk/db";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { listeningGoalFixture, listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import {
  choiceItemContent,
  itemFixture,
  itemSetFixture,
  textSetContent,
} from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadListeningSkillIds } from "../exams/listening/listening-skills";
import { mistakeListInputSchema } from "../mistakes/contract";
import { listCurrentUserMistakes } from "../mistakes/list-current-user-mistakes";
import { getTodayStudySession } from "./_test-utils/open-today";
import {
  SESSION_NOW,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { loadPracticeItems } from "./_utils/load-practice";
import { answerStudyQuestion } from "./answer-study-question";
import { readBlockPayload } from "./block-payload";
import { finishStudyBlock } from "./finish-study-block";
import { getStudyBlock } from "./get-study-block";
import { startStudyBlock } from "./start-study-block";

const HOUR_MS = 3_600_000;

/**
 * A learner who studied one skill, whose bank has two questions of its own and a passage with
 * three questions on it, written out of order.
 */
async function passageFixture() {
  const user = await userFixture();

  const { goal, planItems, skills } = await sessionGoalFixture({
    itemsPerSkill: 0,
    lessons: 1,
    userId: user.id,
  });

  const skillId = skills[0]?.id ?? "";
  const passage = textSetContent("The Sunday library");
  const set = await itemSetFixture({ content: passage });

  const [third, first, second, ...alone] = await Promise.all([
    itemFixture({ content: choiceItemContent(), setId: set.id, setPosition: 2, skillId }),
    itemFixture({ content: choiceItemContent(), setId: set.id, setPosition: 0, skillId }),
    itemFixture({ content: choiceItemContent(), setId: set.id, setPosition: 1, skillId }),
    itemFixture({ content: choiceItemContent(), skillId }),
    itemFixture({ content: choiceItemContent(), skillId }),
  ]);

  await Promise.all([
    prisma.planItem.update({
      data: { completedAt: daysAgo(4), status: "done" },
      where: { id: planItems[0]?.id },
    }),
    dueSkillFixture({ due: daysAgo(-10), skillId, userId: user.id }),
  ]);

  return {
    alone: alone.map((item) => item.id),
    goal,
    passage,
    setItems: [first, second, third].map((item) => item?.id ?? ""),
    skillId,
    user,
  };
}

async function loadPracticeBlock({ goalId, userId }: { goalId: string; userId: string }) {
  mockSession(userId);

  const today = await getTodayStudySession({ goalId });
  const sessionId = today.status === "ready" ? today.session.id : "";

  return prisma.studySessionBlock.findFirstOrThrow({ where: { kind: "practice", sessionId } });
}

describe("question sets in practice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks a passage's questions together, in order, each showing the passage", async () => {
    const { alone, goal, passage, setItems, user } = await passageFixture();
    const block = await loadPracticeBlock({ goalId: goal.id, userId: user.id });
    const { itemIds } = readBlockPayload(block);

    const start = itemIds.indexOf(setItems[0] ?? "");
    expect(itemIds.slice(start, start + setItems.length)).toStrictEqual(setItems);
    expect(new Set(itemIds)).toStrictEqual(new Set([...setItems, ...alone]));

    const ref = { blockId: block.id, sessionId: block.sessionId };
    await startStudyBlock({ ...ref, input: {} });
    const detail = await getStudyBlock(ref);

    if (detail.status !== "ready") {
      throw new Error("Expected the block's questions");
    }

    const sets = detail.detail.questions.map((question) => [
      question.itemId,
      question.set && [question.set.text, question.set.position, question.set.count],
    ]);

    expect(sets).toStrictEqual(
      itemIds.map((itemId) => {
        const position = setItems.indexOf(itemId);
        return [itemId, position === -1 ? null : [passage.text, position, setItems.length]];
      }),
    );
  });

  it("leaves a passage out while one of its questions was answered in the last day", async () => {
    const { alone, goal, setItems, skillId, user } = await passageFixture();

    await attemptFixture({
      answeredAt: new Date(SESSION_NOW.getTime() - 2 * HOUR_MS),
      itemId: setItems[1],
      skillId,
      userId: user.id,
    });

    const block = await loadPracticeBlock({ goalId: goal.id, userId: user.id });

    expect(new Set(readBlockPayload(block).itemIds)).toStrictEqual(new Set(alone));
  });

  it("brings a passage question's mistake back in today's drill with its passage", async () => {
    const { goal, passage, setItems, skillId, user } = await passageFixture();

    await mistakeFixture({ createdAt: daysAgo(2), itemId: setItems[2], skillId, userId: user.id });

    const block = await loadPracticeBlock({ goalId: goal.id, userId: user.id });
    const payload = readBlockPayload(block);

    expect(payload.drills[0]?.itemIds[0]).toBe(setItems[2]);
    expect(payload.itemIds).not.toContain(setItems[0]);

    const ref = { blockId: block.id, sessionId: block.sessionId };
    await startStudyBlock({ ...ref, input: {} });
    const detail = await getStudyBlock(ref);
    const questions = detail.status === "ready" ? detail.detail.questions : [];

    expect(questions.find((question) => question.itemId === setItems[2])?.set).toMatchObject({
      position: 2,
      text: passage.text,
    });
  });

  it("shows a recording's transcript only after its last question, even when an earlier miss enters the notebook", async () => {
    const user = await userFixture();

    const { goal, skills } = await sessionGoalFixture({
      itemsPerSkill: 0,
      lessons: 1,
      userId: user.id,
    });

    const skillId = skills[0]?.id ?? "";
    const audio = await mediaAssetFixture({ durationMs: 40_000, kind: "audio" });
    const recording = await listeningSetFixture({ mediaAssetId: audio.id });

    const questions = await Promise.all(
      [0, 1].map((setPosition) =>
        itemFixture({ content: choiceItemContent(), setId: recording.id, setPosition, skillId }),
      ),
    );

    const itemIds = questions.map((item) => item.id);
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

    const block = await studySessionBlockFixture({
      kind: "practice",
      payload: { itemIds, skillIds: [skillId] },
      sessionId: session.id,
    });

    mockSession(user.id);
    const ref = { blockId: block.id, sessionId: session.id };
    await startStudyBlock({ ...ref, input: {} });

    const answer = ({ itemId, selectedIndex }: { itemId: string; selectedIndex: number }) =>
      answerStudyQuestion({
        ...ref,
        input: { answer: { selectedIndex }, durationMs: 4000, itemId },
      });

    const first = await answer({ itemId: itemIds[0] ?? "", selectedIndex: 1 });
    expect(first.status === "ready" && first.feedback.transcript).toBeNull();

    const notebook = await listCurrentUserMistakes(
      mistakeListInputSchema.parse({ goalId: goal.id }),
    );

    expect(notebook.status === "ready" && notebook.mistakes).toHaveLength(1);

    expect(
      notebook.status === "ready" && notebook.mistakes[0]?.snapshot.set?.listening?.transcript,
    ).toBeNull();

    const inProgress = await getStudyBlock(ref);

    expect(
      inProgress.status === "ready" && inProgress.detail.questions[0]?.set?.listening?.transcript,
    ).toBeNull();

    const last = await answer({ itemId: itemIds[1] ?? "", selectedIndex: 0 });

    expect(last.status === "ready" && last.feedback.transcript).toStrictEqual([
      { speaker: "Receptionist", text: "Good morning, Riverside Sports Centre. How can I help?" },
      expect.objectContaining({ speaker: "Tom" }),
      { speaker: "Receptionist", text: "Which day were you thinking of?" },
      { speaker: "Tom", text: "Tuesday, no, sorry, Thursday the twelfth." },
    ]);
  });

  // A boss's duel ends once it's decided, won (his shield breaks) or lost (it can't break anymore),
  // which can leave a recording's last question unasked: the duel is over, so what was said shows
  // as it would after its last question.
  it.each([
    { optionIndex: 0, outcome: "won" },
    { optionIndex: 1, outcome: "lost" },
  ])(
    "shows a recording's transcript once a boss's duel is $outcome before its last question",
    async ({ optionIndex }) => {
      const user = await userFixture();

      const { goal, skills } = await sessionGoalFixture({
        itemsPerSkill: 0,
        lessons: 1,
        userId: user.id,
      });

      const skillId = skills[0]?.id ?? "";
      const audio = await mediaAssetFixture({ durationMs: 40_000, kind: "audio" });
      const recording = await listeningSetFixture({ mediaAssetId: audio.id });

      const questions = await Promise.all(
        [0, 1, 2].map((setPosition) =>
          itemFixture({ content: choiceItemContent(), setId: recording.id, setPosition, skillId }),
        ),
      );

      const itemIds = questions.map((item) => item.id);
      const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

      const block = await studySessionBlockFixture({
        kind: "checkpoint",
        payload: {
          checkpoint: {
            kind: "boss",
            mock: false,
            passMark: 2,
            phase: 0,
            rematch: false,
            timeLimitMinutes: null,
          },
          itemIds,
          skillIds: [skillId],
        },
        sessionId: session.id,
        startedAt: SESSION_NOW,
        status: "active",
      });

      mockSession(user.id);
      const ref = { blockId: block.id, sessionId: session.id };

      const answer = (itemId: string) =>
        answerStudyQuestion({
          ...ref,
          input: { answer: { selectedIndex: optionIndex }, durationMs: 4000, itemId },
        });

      const first = await answer(itemIds[0] ?? "");
      expect(first.status === "ready" && first.feedback.transcript).toBeNull();

      // Two right of three win it; two misses leave too few to.
      const deciding = await answer(itemIds[1] ?? "");

      expect(deciding.status === "ready" && deciding.feedback.transcript).toContainEqual({
        speaker: "Tom",
        text: "Tuesday, no, sorry, Thursday the twelfth.",
      });

      const decided = await getStudyBlock(ref);

      expect(
        decided.status === "ready" && decided.detail.questions[2]?.set?.listening?.transcript,
      ).toContainEqual({ speaker: "Tom", text: "Tuesday, no, sorry, Thursday the twelfth." });

      // It settles as it was decided, on the duel's own pass mark.
      await expect(finishStudyBlock({ ...ref, input: {} })).resolves.toMatchObject({
        completion: { checkpoint: { passMark: 2, passed: optionIndex === 0, total: 2 } },
        status: "ready",
      });
    },
  );

  it("asks a listening skill only its recordings, never a text question or a text set", async () => {
    const { blueprint, goal, listeningSkills, reading, user } = await listeningGoalFixture();
    const [heard] = listeningSkills;
    const heardId = heard?.id ?? "";
    const audio = await mediaAssetFixture({ durationMs: 40_000, kind: "audio" });

    const [recording, passage] = await Promise.all([
      listeningSetFixture({ mediaAssetId: audio.id }),
      itemSetFixture(),
      dueSkillFixture({ skillId: heardId, userId: user.id }),
      dueSkillFixture({ skillId: reading.id, userId: user.id }),
    ]);

    const [heardQuestion, readingQuestion, ...questions] = await Promise.all([
      itemFixture({ content: choiceItemContent(), skillId: heardId }),
      itemFixture({ content: choiceItemContent(), skillId: reading.id }),
      ...[recording, passage].map((set) =>
        itemFixture({
          content: choiceItemContent(),
          setId: set.id,
          setPosition: 0,
          skillId: heardId,
        }),
      ),
    ]);

    const practice = await loadPracticeItems({
      difficultyBias: "standard",
      examBlueprintId: blueprint.id,
      excludeItemIds: new Set(),
      field: null,
      listeningSkillIds: await loadListeningSkillIds(goal.id),
      now: SESSION_NOW,
      skillIds: [heardId, reading.id],
      typed: true,
      userId: user.id,
    });

    expect(new Set(practice.map((item) => item.itemId))).toStrictEqual(
      new Set([readingQuestion.id, questions[0]?.id]),
    );

    expect(practice.map((item) => item.itemId)).not.toContain(heardQuestion.id);
  });

  it("confirms a listening skill the learner was taken to know with a whole recording", async () => {
    const { blueprint, goal, listeningSkills, reading, user } = await listeningGoalFixture();
    const heardId = listeningSkills[0]?.id ?? "";
    const audio = await mediaAssetFixture({ durationMs: 40_000, kind: "audio" });
    const recording = await listeningSetFixture({ mediaAssetId: audio.id });

    const [second, first] = await Promise.all([
      itemFixture({
        content: choiceItemContent(),
        setId: recording.id,
        setPosition: 1,
        skillId: heardId,
      }),
      itemFixture({
        content: choiceItemContent(),
        setId: recording.id,
        setPosition: 0,
        skillId: heardId,
      }),
      itemFixture({ content: choiceItemContent(), skillId: heardId }),
    ]);

    const practice = await loadPracticeItems({
      claims: { first: new Set([heardId]), last: new Set(), lastAsked: new Map() },
      difficultyBias: "standard",
      examBlueprintId: blueprint.id,
      excludeItemIds: new Set(),
      field: null,
      listeningSkillIds: await loadListeningSkillIds(goal.id),
      now: SESSION_NOW,
      skillIds: [reading.id],
      typed: true,
      userId: user.id,
    });

    // One question of a recording can't stand for it: the whole recording is asked, in order.
    expect(practice.map((item) => item.itemId)).toStrictEqual([first.id, second.id]);
  });
});
