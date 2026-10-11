import { type Skill, prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { listeningExamFixture, listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../../learner/_test-utils/learner-goal";
import { getChapterTestOut } from "../../learner/test-out/get-chapter-test-out";
import { getMistakePractice } from "../../mistakes/get-mistake-practice";
import { getFocusTest } from "../../plans/focus-test/get-focus-test";
import { getTodayStudySession } from "../../sessions/_test-utils/open-today";
import {
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "../../sessions/_test-utils/session-goal";
import { getBlockItemIds, readBlockPayload } from "../../sessions/block-payload";

vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));

/**
 * An exam's listening skills are practiced only with recordings: a text question about a
 * conversation tests reading. Practice asks their recordings whole (sessions/item-set-practice);
 * everything else that asks single bank questions (reviews, drills, challenges, Practice mistakes,
 * test-outs, focus tests) leaves their text questions out, the ones another goal's writers left on
 * a shared skill included.
 */

/** Gives the plan's skills these areas, so the exam's "Listening" section claims its own. */
function setGraphAreas({
  phases = 1,
  planId,
  skills,
}: {
  phases?: number;
  planId: string;
  skills: { area: string; phase?: number; skill: Skill }[];
}) {
  return prisma.plan.update({
    data: {
      graph: {
        phases: Array.from({ length: phases }, (_, index) => ({
          milestone: null,
          name: `Phase ${index + 1}`,
        })),
        skills: skills.map(({ area, phase = 0, skill }) => ({
          area,
          lessons: 1,
          name: skill.name,
          phase,
          skillId: skill.id,
          weight: null,
        })),
      },
    },
    where: { id: planId },
  });
}

const LISTENING_GOAL = { kind: "exam", targetLanguage: "en" } as const;

/**
 * An IELTS-like learner whose plan teaches a Listening skill (`heard`) and three Reading ones, six
 * text questions each, with the first two lessons done. Ten minutes a day spread the other two
 * over the next days, so the phase's challenge doesn't take today and the day has room for
 * reviews, a drill and practice.
 */
async function listeningLearnerFixture() {
  const user = await userFixture();
  const { blueprint } = await listeningExamFixture();

  const fixture = await sessionGoalFixture({
    goal: { ...LISTENING_GOAL, dailyMinutes: 10, examBlueprintId: blueprint.id },
    itemsPerSkill: 6,
    lessons: 4,
    userId: user.id,
  });

  const [heard, ...read] = fixture.skills;

  await Promise.all([
    setGraphAreas({
      planId: fixture.plan.id,
      skills: fixture.skills.map((skill, index) => ({
        area: index === 0 ? "Listening" : "Reading",
        skill,
      })),
    }),
    prisma.planItem.updateMany({
      data: { completedAt: daysAgo(4), status: "done" },
      where: { id: { in: fixture.planItems.slice(0, 2).map((item) => item.id) } },
    }),
  ]);

  const heardId = heard?.id ?? "";

  return {
    ...fixture,
    heardId,
    heardItemIds: new Set(
      fixture.items.filter((item) => item.skillId === heardId).map(({ id }) => id),
    ),
    readIds: read.map((skill) => skill.id),
    user,
  };
}

/** A typed gap fill, as a recording's form completion asks it. */
const TYPED_GAP = {
  acceptedAnswers: ["Thursday"],
  context: null,
  keyPoints: ["The day the speakers agree on"],
  question: "Day of the booking: ______",
  sampleAnswer: "Thursday",
};

/** A question that asks for two options, which a duel never asks. */
const PICK_TWO = {
  ...choiceItemContent(),
  options: [
    { isCorrect: true, misconception: null, reason: "Said first.", text: "The hall" },
    { isCorrect: true, misconception: null, reason: "Said next.", text: "The chairs" },
    { isCorrect: false, misconception: "Mixes up the offers", reason: "Declined.", text: "Food" },
  ],
  select: 2,
};

/**
 * A recording on the skill with its questions in the order they're heard: two choices by default;
 * voiced unless `voiced` is false.
 */
async function recordingFixture(
  skillId: string,
  {
    questions = [choiceItemContent(), choiceItemContent()],
    voiced = true,
  }: { questions?: object[]; voiced?: boolean } = {},
) {
  const audio = voiced ? await mediaAssetFixture({ durationMs: 40_000, kind: "audio" }) : null;
  const recording = await listeningSetFixture({ mediaAssetId: audio?.id ?? null });

  return Promise.all(
    questions.map((content, setPosition) =>
      itemFixture({
        content,
        format: "question" in content && "acceptedAnswers" in content ? "typed" : "multipleChoice",
        setId: recording.id,
        setPosition,
        skillId,
      }),
    ),
  );
}

/**
 * Puts the plan's first lesson (the Listening skill's, done) alone in its phase, with a boss after
 * it, and the rest in a second phase: today's boss is a listening phase's.
 */
async function listeningPhaseFixture() {
  const fixture = await listeningLearnerFixture();
  const { plan, planItems, skills } = fixture;

  await Promise.all([
    prisma.planItem.update({ data: { status: "todo" }, where: { id: planItems[1]?.id } }),
    ...planItems
      .slice(1)
      .map((item, index) =>
        prisma.planItem.update({ data: { phase: 1, position: 5 + index }, where: { id: item.id } }),
      ),
    setGraphAreas({
      phases: 2,
      planId: plan.id,
      skills: skills.map((skill, index) => ({
        area: index === 0 ? "Listening" : "Reading",
        phase: index === 0 ? 0 : 1,
        skill,
      })),
    }),
  ]);

  await checkpointItemFixture({ kind: "boss", planId: plan.id, position: 1 });

  return fixture;
}

/** Today's blocks for the learner, each with what it asks. */
async function openToday({ goalId, userId }: { goalId: string; userId: string }) {
  mockSession(userId);
  const today = await getTodayStudySession({ goalId, timeZone: "UTC" });

  if (today.status !== "ready") {
    throw new Error(`Expected a session, got ${today.status}`);
  }

  const blocks = await prisma.studySessionBlock.findMany({
    orderBy: { position: "asc" },
    where: { sessionId: today.session.id },
  });

  return blocks.map((block) => {
    const payload = readBlockPayload(block);
    return { itemIds: getBlockItemIds(payload), kind: block.kind, payload };
  });
}

describe("an exam's listening skills outside practice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gets no review capsule of text questions, while the Reading skills keep theirs", async () => {
    const { goal, heardId, heardItemIds, items, readIds, user } = await listeningLearnerFixture();

    await Promise.all(
      [heardId, ...readIds].map((skillId) => dueSkillFixture({ skillId, userId: user.id })),
    );

    const blocks = await openToday({ goalId: goal.id, userId: user.id });
    const capsules = blocks.flatMap((block) => block.payload.capsules);

    const readItemIds = new Set(
      items.filter((item) => readIds.includes(item.skillId)).map(({ id }) => id),
    );

    expect(capsules.flatMap((capsule) => capsule.skillIds)).not.toContain(heardId);

    expect(capsules.flatMap((capsule) => capsule.itemIds).some((id) => readItemIds.has(id))).toBe(
      true,
    );

    expect(
      blocks.flatMap((block) => block.itemIds).filter((id) => heardItemIds.has(id)),
    ).toStrictEqual([]);
  });

  it("comes back in a review with one whole voiced recording when it's due", async () => {
    const { goal, heardId, heardItemIds, user } = await listeningLearnerFixture();

    const [first, second] = await Promise.all([
      recordingFixture(heardId),
      recordingFixture(heardId),
      recordingFixture(heardId, { voiced: false }),
    ]);

    // The first recording was heard a week ago; the review plays the one not heard yet.
    await Promise.all([
      dueSkillFixture({ skillId: heardId, userId: user.id }),
      ...first.map((item) =>
        attemptFixture({
          answeredAt: daysAgo(7),
          itemId: item.id,
          skillId: heardId,
          userId: user.id,
        }),
      ),
    ]);

    const blocks = await openToday({ goalId: goal.id, userId: user.id });

    const capsule = blocks
      .flatMap((block) => block.payload.capsules)
      .find((entry) => entry.skillIds.includes(heardId));

    expect(capsule?.itemIds).toStrictEqual(second.map((item) => item.id));
    expect(capsule?.itemIds.filter((id) => heardItemIds.has(id))).toStrictEqual([]);
  });

  it("drills a missed recording question alone, and leaves its recording out of the review meanwhile", async () => {
    const { goal, heardId, user } = await listeningLearnerFixture();
    const [heard, missed] = await recordingFixture(heardId);

    await Promise.all([
      dueSkillFixture({ skillId: heardId, userId: user.id }),
      mistakeFixture({
        createdAt: daysAgo(2),
        itemId: missed?.id,
        skillId: heardId,
        userId: user.id,
      }),
    ]);

    const blocks = await openToday({ goalId: goal.id, userId: user.id });
    const drills = blocks.flatMap((block) => block.payload.drills);
    const capsules = blocks.flatMap((block) => block.payload.capsules);

    // Nothing more on its skill: the drill is the missed question alone.
    expect(drills.map((drill) => drill.itemIds)).toStrictEqual([[missed?.id]]);
    expect(capsules.flatMap((capsule) => capsule.itemIds)).not.toContain(heard?.id);
  });

  it("never drills an old text mistake on it, so the day's drill goes to the next mistake", async () => {
    const { goal, heardId, heardItemIds, items, readIds, user } = await listeningLearnerFixture();
    const readItem = items.find((item) => item.skillId === readIds[0]);

    const [, readMistake] = await Promise.all([
      mistakeFixture({
        createdAt: daysAgo(3),
        itemId: [...heardItemIds][0],
        skillId: heardId,
        userId: user.id,
      }),
      mistakeFixture({
        createdAt: daysAgo(2),
        itemId: readItem?.id,
        skillId: readIds[0],
        userId: user.id,
      }),
    ]);

    const blocks = await openToday({ goalId: goal.id, userId: user.id });
    const drills = blocks.flatMap((block) => block.payload.drills);

    expect(drills.map((drill) => drill.mistakeId)).toStrictEqual([readMistake.id]);
    expect(drills.flatMap((drill) => drill.itemIds)).toContain(readItem?.id);
  });

  it("stays out of its phase's challenge", async () => {
    const { goal, heardId, heardItemIds, plan, planItems, readIds, skills, user } =
      await listeningLearnerFixture();

    // The lessons not done move to a second phase, so the first phase's boss is reached today.
    await Promise.all([
      ...planItems
        .slice(2)
        .map((item, index) =>
          prisma.planItem.update({
            data: { phase: 1, position: 5 + index },
            where: { id: item.id },
          }),
        ),
      setGraphAreas({
        phases: 2,
        planId: plan.id,
        skills: skills.map((skill, index) => ({
          area: index === 0 ? "Listening" : "Reading",
          phase: index < 2 ? 0 : 1,
          skill,
        })),
      }),
    ]);

    await checkpointItemFixture({ kind: "boss", planId: plan.id, position: 2 });

    const blocks = await openToday({ goalId: goal.id, userId: user.id });
    const boss = blocks.find((block) => block.kind === "checkpoint");

    expect(boss?.payload.skillIds).toStrictEqual([readIds[0]]);
    expect(boss?.itemIds.length).toBeGreaterThan(0);
    expect(boss?.itemIds.filter((id) => heardItemIds.has(id))).toStrictEqual([]);
    expect(boss?.payload.skillIds).not.toContain(heardId);
  });

  it("makes a listening phase's boss of a whole voiced recording, played like a mock", async () => {
    const { goal, heardId, heardItemIds, user } = await listeningPhaseFixture();
    const choices = Array.from({ length: 4 }, () => choiceItemContent());

    // A recording the duel can't ask whole (one question takes two picks) and one not voiced yet.
    await Promise.all([
      recordingFixture(heardId, { questions: [...choices, PICK_TWO] }),
      recordingFixture(heardId, { questions: [...choices, TYPED_GAP], voiced: false }),
    ]);

    const played = await recordingFixture(heardId, { questions: [...choices, TYPED_GAP] });

    const blocks = await openToday({ goalId: goal.id, userId: user.id });
    const boss = blocks.find((block) => block.kind === "checkpoint");

    expect(boss?.payload.checkpoint?.kind).toBe("boss");
    expect(boss?.itemIds).toStrictEqual(played.map((item) => item.id));
    expect(boss?.payload.skillIds).toStrictEqual([heardId]);
    expect(boss?.itemIds.filter((id) => heardItemIds.has(id))).toStrictEqual([]);
  });

  it("holds a listening phase's boss back while no recording can make it", async () => {
    const { goal, heardId, user } = await listeningPhaseFixture();

    await recordingFixture(heardId, {
      questions: Array.from({ length: 5 }, () => choiceItemContent()),
      voiced: false,
    });

    const blocks = await openToday({ goalId: goal.id, userId: user.id });

    expect(blocks.map((block) => block.kind)).not.toContain("checkpoint");
  });

  it("stays out of a weekly challenge on the week's skills", async () => {
    const { goal, heardId, heardItemIds, items, plan, readIds, user } =
      await listeningLearnerFixture();

    // The learner answered on every skill this week, the Listening one through a recording.
    const [recorded] = await recordingFixture(heardId);
    const answered = [recorded, ...readIds.map((id) => items.find((item) => item.skillId === id))];

    await Promise.all([
      checkpointItemFixture({
        kind: "checkpoint",
        planId: plan.id,
        position: 10,
        scheduledFor: SESSION_TODAY,
      }),
      ...answered.map((item) =>
        attemptFixture({
          answeredAt: daysAgo(2),
          isCorrect: true,
          itemId: item?.id,
          skillId: item?.skillId,
          userId: user.id,
        }),
      ),
    ]);

    const blocks = await openToday({ goalId: goal.id, userId: user.id });
    const weekly = blocks.find((block) => block.kind === "checkpoint");

    expect(weekly?.payload.checkpoint?.kind).toBe("weekly");
    expect(weekly?.itemIds.length).toBeGreaterThan(0);
    expect(weekly?.itemIds.filter((id) => heardItemIds.has(id))).toStrictEqual([]);
    expect(weekly?.payload.skillIds).not.toContain(heardId);
  });

  it.each([
    { scope: "for its goal", scoped: true },
    // The notebook without a goal: a skill any of the learner's goals hears counts.
    { scope: "without a goal", scoped: false },
  ])(
    "brings back only its missed recording questions in Practice mistakes $scope",
    async ({ scoped }) => {
      const { goal, heardId, heardItemIds, items, readIds, user } = await listeningLearnerFixture();
      const [, missed] = await recordingFixture(heardId);
      const readItem = items.find((item) => item.skillId === readIds[0]);

      const [, recordingMistake, readMistake] = await Promise.all([
        mistakeFixture({
          createdAt: daysAgo(4),
          itemId: [...heardItemIds][0],
          skillId: heardId,
          userId: user.id,
        }),
        mistakeFixture({
          createdAt: daysAgo(3),
          itemId: missed?.id,
          skillId: heardId,
          userId: user.id,
        }),
        mistakeFixture({
          createdAt: daysAgo(2),
          itemId: readItem?.id,
          skillId: readIds[0],
          userId: user.id,
        }),
      ]);

      mockSession(user.id);

      const result = await getMistakePractice({
        goalId: scoped ? goal.id : undefined,
        timeZone: "UTC",
      });

      const practice = result.status === "ready" ? result.practice : [];

      expect(practice.map((entry) => entry.mistakeId)).toStrictEqual([
        recordingMistake.id,
        readMistake.id,
      ]);

      expect(practice[0]?.questions.map((question) => question.itemId)).toStrictEqual([missed?.id]);
      expect(practice[0]?.questions[0]?.set?.listening).toBeTruthy();
    },
  );
});

describe("an exam's listening skills in text tests", () => {
  it("offers no test-out of a chapter that teaches only them, and tests a mixed one on the rest", async () => {
    const user = await userFixture();
    const { blueprint } = await listeningExamFixture();

    const { chapters, goal, plan, skills } = await learnerGoalFixture({
      itemsPerSkill: 4,
      phases: [2, 2],
      userId: user.id,
    });

    await Promise.all([
      prisma.goal.update({
        data: { ...LISTENING_GOAL, examBlueprintId: blueprint.id },
        where: { id: goal.id },
      }),
      setGraphAreas({
        phases: 2,
        planId: plan.id,
        skills: skills.map((skill, index) => ({
          area: index < 3 ? "Listening" : "Reading",
          phase: index < 2 ? 0 : 1,
          skill,
        })),
      }),
    ]);

    mockSession(user.id);

    await expect(
      getChapterTestOut({ chapterId: chapters[0]?.id ?? "", goalId: goal.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    const mixed = await getChapterTestOut({ chapterId: chapters[1]?.id ?? "", goalId: goal.id });
    const asked = mixed.status === "ready" ? mixed.testOut.questions : [];

    expect(asked.length).toBeGreaterThan(0);

    expect(new Set(asked.map((question) => question.skillId))).toStrictEqual(
      new Set([skills[3]?.id]),
    );
  });

  it("leaves the Listening area out of the focus test", async () => {
    const user = await userFixture();
    const { blueprint } = await listeningExamFixture();

    const goal = await goalFixture({
      ...LISTENING_GOAL,
      details: { placementDeclined: true },
      examBlueprintId: blueprint.id,
      userId: user.id,
    });

    const areas = ["Listening", "Reading", "Vocabulary"];

    const skills = await Promise.all(
      areas.flatMap((area) =>
        [1, 2].map(async (index) => ({
          area,
          skill: await skillFixture({ name: `${area} ${index}` }),
        })),
      ),
    );

    const plan = await planFixture({ goalId: goal.id });

    await Promise.all([
      setGraphAreas({ planId: plan.id, skills }),
      ...skills.map(({ skill }) =>
        itemFixture({ content: choiceItemContent(), skillId: skill.id }),
      ),
    ]);

    mockSession(user.id);
    const result = await getFocusTest({ goalId: goal.id });

    const listening = new Set(
      skills.filter(({ area }) => area === "Listening").map(({ skill }) => skill.id),
    );

    expect(result).toMatchObject({
      focusTest: { areas: ["Reading", "Vocabulary"] },
      status: "ready",
    });

    expect(
      result.status === "ready" &&
        result.focusTest.questions.filter((question) => listening.has(question.skillId)),
    ).toStrictEqual([]);
  });
});
