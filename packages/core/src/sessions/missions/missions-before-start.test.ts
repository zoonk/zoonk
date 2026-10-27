import { assessPronunciation } from "@zoonk/ai/tasks/v2/language/assess-pronunciation";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { startLanguageConversation } from "../../language/conversations/start-language-conversation";
import { practiceMistakePattern } from "../../language/patterns/practice-mistake-pattern";
import { answerPronunciationReview } from "../../language/pronunciation/answer-pronunciation-review";
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
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { getTodayView } from "../../view-models/today/get-today-view";
import { SESSION_NOW, SESSION_TODAY, sessionGoalFixture } from "../_test-utils/session-goal";
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
    const [{ goal, user }, organization] = await Promise.all([
      languageGoalFixture(),
      aiOrganizationFixture(),
    ]);

    const word = await wordFixture({
      organizationId: organization.id,
      targetLanguage: "en",
      word: `rent${crypto.randomUUID().slice(0, 8)}`,
    });

    const review = await pronunciationReviewFixture({ userId: user.id, wordId: word.id });
    mockSession(user.id);

    const shown = await readShownMissions(goal.id);

    vi.mocked(assessPronunciation).mockResolvedValueOnce({
      data: {
        transcript: word.word,
        words: [{ heard: null, issue: null, status: "correct", text: word.word }],
      },
    } as Awaited<ReturnType<typeof assessPronunciation>>);

    await expect(
      answerPronunciationReview({
        audio: { bytes: new Uint8Array([1, 2, 3]), mediaType: "audio/webm;codecs=opus" },
        fields: { durationMs: 1200, roundId: crypto.randomUUID(), timeZone: TIME_ZONE },
        reviewId: review.id,
      }),
    ).resolves.toMatchObject({ status: "graded" });

    await expect(readSavedMissions(goal.id)).resolves.toStrictEqual([shown]);
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
