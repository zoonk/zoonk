import { assessPronunciation } from "@zoonk/ai/tasks/v2/language/assess-pronunciation";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { startLanguageConversation } from "../../language/conversations/start-language-conversation";
import { practiceMistakePattern } from "../../language/patterns/practice-mistake-pattern";
import { answerPronunciationReview } from "../../language/pronunciation/answer-pronunciation-review";
import { finishPronunciationRound } from "../../language/pronunciation/finish-pronunciation-round";
import {
  setupPlayableLesson,
  stepOfKind,
} from "../../lesson-player/_test-utils/playable-lesson-setup";
import { checkLessonStep } from "../../lesson-player/check-lesson-step";
import { completeLibraryLesson } from "../../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../../lesson-player/start-library-lesson";
import { createLessonQuestion } from "../../lesson-questions/create-lesson-question";
import { answerMistakePractice } from "../../mistakes/answer-mistake-practice";
import { finishMistakePractice } from "../../mistakes/finish-mistake-practice";
import * as planning from "../../plans/_utils/replan";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { getTodayView } from "../../view-models/today/get-today-view";
import { SESSION_NOW, SESSION_TODAY, sessionGoalFixture } from "../_test-utils/session-goal";
import { saveDayBeforeActivity } from "../ensure-study-session";
import { openStudyDay } from "../open-study-day";
import { readMissionDocument } from "./catalog";

const TIME_ZONE = "UTC";

/** The missions Today shows for the goal's day, which nobody opened yet, in order. */
async function readShownMissions(goalId: string) {
  const result = await getTodayView({ goalId, timeZone: TIME_ZONE });

  if (result.status !== "ready") {
    throw new Error(`Expected Today, got ${result.status}`);
  }

  expect(result.today.session.status).toBe("unstarted");
  return result.today.session.missions.map((mission) => mission.kind);
}

/** The missions of each day saved for the goal. */
async function readSavedMissions(goalId: string) {
  const days = await prisma.studySession.findMany({ where: { goalId } });
  return days.map((day) => readMissionDocument(day.missions)?.picks.map((pick) => pick.kind));
}

/** A pattern noticed yesterday, with a one-question drill the day's missions can offer. */
function patternFixture({ goalId, userId }: { goalId: string; userId: string }) {
  return prisma.mistakePattern.create({
    data: {
      content: {
        contrast: [],
        drill: [
          {
            answer: "for",
            feedback: "Use for with a length of time.",
            options: ["for", "since"],
            sentence: "I've lived here ___ two years.",
          },
        ],
        examples: [],
        rule: "Use for with durations.",
      },
      createdAt: new Date(SESSION_NOW.getTime() - MS_PER_DAY),
      goalId,
      kind: "pattern",
      language: "en",
      model: "test",
      promptVersion: "test",
      runId: "test",
      title: "Since and for",
      userId,
    },
  });
}

function drillInput() {
  return { answers: ["for"], requestId: crypto.randomUUID(), timeZone: TIME_ZONE };
}

/** A word due for review, which the grader then hears said right once. */
async function dueWordFixture(userId: string) {
  const organization = await aiOrganizationFixture();

  const word = await wordFixture({
    organizationId: organization.id,
    targetLanguage: "en",
    word: `rent${crypto.randomUUID().slice(0, 8)}`,
  });

  vi.mocked(assessPronunciation).mockResolvedValueOnce({
    data: {
      transcript: word.word,
      words: [{ heard: null, issue: null, status: "correct", text: word.word }],
    },
  } as Awaited<ReturnType<typeof assessPronunciation>>);

  return pronunciationReviewFixture({ userId, wordId: word.id });
}

/** A pronunciation round's answer, for the goal it names. */
function answerWord({
  goalId,
  reviewId,
  roundId = crypto.randomUUID(),
}: {
  goalId: string;
  reviewId: string;
  roundId?: string;
}) {
  return answerPronunciationReview({
    audio: { bytes: new Uint8Array([1, 2, 3]), mediaType: "audio/webm;codecs=opus" },
    fields: { durationMs: 1200, goalId, roundId, timeZone: TIME_ZONE },
    reviewId,
  });
}

describe("an activity done from Today before the learner starts the day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: SESSION_NOW, toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("credits a pattern drill to the day Today showed, once", async () => {
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    const pattern = await patternFixture({ goalId: goal.id, userId: user.id });
    const shown = await readShownMissions(goal.id);

    expect(shown).toContain("pattern");

    const input = drillInput();
    const drilled = await practiceMistakePattern({ input, patternId: pattern.id });

    expect(drilled).toMatchObject({
      result: { missionMoment: { completed: ["pattern"] } },
      status: "ready",
    });

    await expect(readSavedMissions(goal.id)).resolves.toStrictEqual([shown]);

    // The same drill sent again says the same; drilling the pattern again completes nothing more.
    await expect(practiceMistakePattern({ input, patternId: pattern.id })).resolves.toStrictEqual(
      drilled,
    );

    await expect(
      practiceMistakePattern({ input: drillInput(), patternId: pattern.id }),
    ).resolves.toMatchObject({ result: { missionMoment: null }, status: "ready" });

    await expect(readSavedMissions(goal.id)).resolves.toStrictEqual([shown]);
  });

  it("opens one day when Start is tapped while a drill saves it", async () => {
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    // The goal keeps the zone Start sends, so Start doesn't move it while the drill saves the day.
    await prisma.goal.update({ data: { timezone: TIME_ZONE }, where: { id: goal.id } });

    const pattern = await patternFixture({ goalId: goal.id, userId: user.id });
    const shown = await readShownMissions(goal.id);

    const [drilled, opened] = await Promise.all([
      practiceMistakePattern({ input: drillInput(), patternId: pattern.id }),
      openStudyDay({ goalId: goal.id, shownDate: toIsoDate(SESSION_TODAY), timeZone: TIME_ZONE }),
    ]);

    expect(opened.status).toBe("opened");

    expect(drilled).toMatchObject({
      result: { missionMoment: { completed: ["pattern"] } },
      status: "ready",
    });

    await expect(readSavedMissions(goal.id)).resolves.toStrictEqual([shown]);
  });

  it("saves the day at a notebook practice's first answer, before it fixes anything", async () => {
    const user = await userFixture();
    const { goal, items, skills } = await sessionGoalFixture({ userId: user.id });
    mockSession(user.id);

    const mistake = await mistakeFixture({
      cause: "misread",
      createdAt: new Date(SESSION_NOW.getTime() - MS_PER_DAY),
      itemId: items[0]?.id,
      skillId: skills[0]?.id,
      userId: user.id,
    });

    const shown = await readShownMissions(goal.id);
    expect(shown).toContain("fixMistake");

    const answered = await answerMistakePractice({
      input: {
        answer: { selectedIndex: 0 },
        durationMs: 5000,
        itemId: mistake.itemId ?? "",
        run: { answerIds: [], goalId: goal.id },
        timeZone: TIME_ZONE,
      },
      mistakeId: mistake.id,
    });

    if (answered.status !== "ready") {
      throw new Error(`Mistake answer failed: ${answered.status}`);
    }

    expect(answered.feedback.mistakeStatus).toBe("fixed");

    const finished = await finishMistakePractice({
      answerIds: [answered.feedback.answerId],
      ended: true,
      goalId: goal.id,
      timeZone: TIME_ZONE,
    });

    expect(finished).toMatchObject({
      result: { missionMoment: { completed: ["fixMistake"] } },
      status: "ready",
    });

    await expect(readSavedMissions(goal.id)).resolves.toStrictEqual([shown]);
  });

  it("credits a question to the buddy to the day Today showed", async () => {
    const [{ goal, user }, { lesson }] = await Promise.all([
      languageGoalFixture(),
      playableLessonFixture(),
    ]);

    mockSession(user.id);

    const shown = await readShownMissions(goal.id);
    expect(shown).toContain("askBuddy");

    const question = await createLessonQuestion({
      input: { context: { kind: "lesson" }, question: "Why?", requestId: crypto.randomUUID() },
      target: { kind: "lesson", lessonId: lesson.id },
    });

    expect(question).toMatchObject({
      missionMoment: { completed: ["askBuddy"] },
      status: "created",
    });

    await expect(readSavedMissions(goal.id)).resolves.toStrictEqual([shown]);
  });

  it("completes the day's block of a lesson played from its chapter", async () => {
    const { lesson, steps, user } = await setupPlayableLesson({
      steps: ["hook", "explanation", "check", "summary"],
    });

    const goal = await goalFixture({ timezone: TIME_ZONE, userId: user.id });
    const plan = await planFixture({ goalId: goal.id });

    await planItemFixture({
      kind: "lesson",
      lessonId: lesson.id,
      planId: plan.id,
      position: 0,
      titleSnapshot: lesson.title,
    });

    const shown = await readShownMissions(goal.id);
    expect(shown).toContain("somethingNew");

    const started = await startLibraryLesson({
      input: { timeZone: TIME_ZONE },
      lessonId: lesson.id,
    });

    const runId = started.status === "started" ? started.run.runId : "";

    await checkLessonStep({
      input: {
        answer: { kind: "check", optionId: "likely" },
        durationMs: 4000,
        runId,
        timeZone: TIME_ZONE,
      },
      stepId: stepOfKind(steps, "check").id,
    });

    await expect(
      completeLibraryLesson({ input: { runId, timeZone: TIME_ZONE }, lessonId: lesson.id }),
    ).resolves.toMatchObject({
      completion: { studyBlock: { completedMissions: ["somethingNew"] } },
      status: "completed",
    });

    await expect(readSavedMissions(goal.id)).resolves.toStrictEqual([shown]);
  });

  it("saves a language goal's day when a practice call starts", async () => {
    const { goal, renting, user } = await languageGoalFixture();
    mockSession(user.id);

    const shown = await readShownMissions(goal.id);

    await expect(
      startLanguageConversation({
        chapterId: renting.id,
        goalId: goal.id,
        kind: "practice",
        minutes: 1,
      }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(readSavedMissions(goal.id)).resolves.toStrictEqual([shown]);
  });

  it("saves a language goal's day at a pronunciation round's first answer", async () => {
    const { goal, user } = await languageGoalFixture();
    const review = await dueWordFixture(user.id);
    mockSession(user.id);

    const shown = await readShownMissions(goal.id);

    await expect(answerWord({ goalId: goal.id, reviewId: review.id })).resolves.toMatchObject({
      status: "graded",
    });

    await expect(readSavedMissions(goal.id)).resolves.toStrictEqual([shown]);
  });

  // Today offers a pattern on any goal learning its language, whichever goal noticed it.
  it.each(["paused", "removed"] as const)(
    "credits a drill to the goal whose Today offered it when the goal that noticed it is %s",
    async (noticedGoal) => {
      const noticed = await languageGoalFixture();
      const { goal, user } = await languageGoalFixture({ userId: noticed.user.id });

      const [pattern] = await Promise.all([
        patternFixture({ goalId: noticed.goal.id, userId: user.id }),
        learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      ]);

      await (noticedGoal === "paused"
        ? prisma.goal.update({ data: { status: "paused" }, where: { id: noticed.goal.id } })
        : prisma.goal.delete({ where: { id: noticed.goal.id } }));

      mockSession(user.id);

      const shown = await readShownMissions(goal.id);
      expect(shown).toContain("pattern");

      await expect(
        practiceMistakePattern({ input: drillInput(), patternId: pattern.id }),
      ).resolves.toMatchObject({
        result: { missionMoment: { completed: ["pattern"] } },
        status: "ready",
      });

      await expect(readSavedMissions(goal.id)).resolves.toStrictEqual([shown]);
    },
  );

  it("saves the day of the goal a pronunciation round is for, not another goal of its language", async () => {
    const round = await languageGoalFixture();
    const { user } = round;
    const newer = await languageGoalFixture({ userId: user.id });

    // The round's goal is the one the learner picked; another goal of the language changed later.
    await Promise.all([
      prisma.goal.update({
        data: { timezone: TIME_ZONE, updatedAt: new Date(SESSION_NOW.getTime() - 1000) },
        where: { id: round.goal.id },
      }),
      prisma.goal.update({
        data: { timezone: TIME_ZONE, updatedAt: SESSION_NOW },
        where: { id: newer.goal.id },
      }),
      learningProfileFixture({ activeGoalId: round.goal.id, userId: user.id }),
      learningEventFixture({
        endedAt: new Date(SESSION_NOW.getTime() - MS_PER_DAY),
        goalId: round.goal.id,
        userId: user.id,
      }),
    ]);

    const review = await dueWordFixture(user.id);
    mockSession(user.id);

    const shown = await readShownMissions(round.goal.id);
    expect(shown).toContain("pronunciation");

    const roundId = crypto.randomUUID();

    await expect(
      answerWord({ goalId: round.goal.id, reviewId: review.id, roundId }),
    ).resolves.toMatchObject({ status: "graded" });

    await expect(
      finishPronunciationRound({ input: { goalId: round.goal.id, timeZone: TIME_ZONE }, roundId }),
    ).resolves.toMatchObject({
      result: { missionMoment: { completed: ["pronunciation"] } },
      status: "ready",
    });

    await expect(
      Promise.all([readSavedMissions(round.goal.id), readSavedMissions(newer.goal.id)]),
    ).resolves.toStrictEqual([[shown], []]);
  });

  it("saves no day for a round naming another learner's goal or one not learning the word's language", async () => {
    const [{ user }, other] = await Promise.all([languageGoalFixture(), languageGoalFixture()]);

    const spanish = await goalFixture({
      kind: "language",
      targetLanguage: "es",
      timezone: TIME_ZONE,
      userId: user.id,
    });

    const reviews = [await dueWordFixture(user.id), await dueWordFixture(user.id)];
    mockSession(user.id);

    await expect(
      Promise.all([
        answerWord({ goalId: other.goal.id, reviewId: reviews[0]?.id ?? "" }),
        answerWord({ goalId: spanish.id, reviewId: reviews[1]?.id ?? "" }),
      ]),
    ).resolves.toMatchObject([{ status: "graded" }, { status: "graded" }]);

    await expect(
      prisma.studySession.count({ where: { userId: { in: [user.id, other.user.id] } } }),
    ).resolves.toBe(0);
  });

  it("saves nothing for a paused goal or one whose day can't open, and the drill still counts", async () => {
    const user = await userFixture();

    const [paused, unplanned] = await Promise.all([
      languageGoalFixture({ userId: user.id }).then(({ goal }) =>
        prisma.goal.update({ data: { status: "paused" }, where: { id: goal.id } }),
      ),
      goalFixture({ kind: "language", targetLanguage: "en", timezone: TIME_ZONE, userId: user.id }),
    ]);

    mockSession(user.id);

    const patterns = await Promise.all(
      [paused, unplanned].map((goal) => patternFixture({ goalId: goal.id, userId: user.id })),
    );

    const drilled = await Promise.all(
      patterns.map((pattern) =>
        practiceMistakePattern({ input: drillInput(), patternId: pattern.id }),
      ),
    );

    expect(drilled).toMatchObject([
      { result: { correct: 1, missionMoment: null }, status: "ready" },
      { result: { correct: 1, missionMoment: null }, status: "ready" },
    ]);

    await expect(prisma.studySession.count({ where: { userId: user.id } })).resolves.toBe(0);
  });
});

describe("an activity on a day that offers no missions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: SESSION_NOW, toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Each answer of a round or a notebook practice asks again: none of them may re-plan the day.
  it.each(["a rest day", "a used-up daily limit"] as const)(
    "saves nothing and never runs the planner on %s",
    async (day) => {
      const user = await userFixture();
      const { goal, plan, skills } = await sessionGoalFixture({ userId: user.id });
      // SESSION_NOW is a Wednesday, the fourth of the week's minutes.
      const weekdayMinutes =
        day === "a rest day" ? [45, 45, 45, 0, 45, 45, 45] : [45, 45, 45, 45, 45, 45, 45];

      // With its skill graph, the plan would be selected afresh (`computePlan`) to open the day.
      await prisma.plan.update({
        data: {
          graph: {
            phases: [{ milestone: "Basics", name: "Basics" }],
            skills: skills.map((skill) => ({
              area: null,
              lessons: 1,
              name: skill.name,
              phase: 0,
              skillId: skill.id,
              weight: null,
            })),
          },
          settings: { startDate: "2026-09-29", weekdayMinutes },
        },
        where: { id: plan.id },
      });

      if (day === "a used-up daily limit") {
        await Promise.all([
          learningProfileFixture({ dailyLimitMinutes: 15, userId: user.id }),
          dailyProgressFixtureMany([
            { date: SESSION_TODAY, timeSpentSeconds: 15 * 60, userId: user.id },
          ]),
        ]);
      }

      const planner = vi.spyOn(planning, "computePlan");
      const activity = { goalId: goal.id, timeZone: TIME_ZONE, userId: user.id };

      await saveDayBeforeActivity(activity);
      await saveDayBeforeActivity(activity);

      expect(planner).not.toHaveBeenCalled();
      await expect(prisma.studySession.count({ where: { userId: user.id } })).resolves.toBe(0);
      planner.mockRestore();
    },
  );
});
