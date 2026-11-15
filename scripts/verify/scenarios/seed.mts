import { getTestLearnerRefusal } from "../../../apps/api/scripts/_utils/test-learners.ts";
import {
  getActiveGoalLimit,
  getUsageRule,
} from "../../../packages/core/src/entitlements/limits.ts";
/* oxlint-disable no-console -- The runner reads the seeded route from stdout. */
import { PROFILE_QUESTIONS } from "../../../packages/core/src/profile/questions/profile-question-contract.ts";
import { type Goal, type Plan, prisma } from "../../../packages/db/src/index.ts";
import {
  goalFixture,
  planFixture,
  suggestedGoalFixture,
} from "../../../packages/testing/src/fixtures/goals.ts";
import {
  RENTING_SCENARIO,
  languageGoalFixture,
} from "../../../packages/testing/src/fixtures/language.ts";
import { mistakeFixture } from "../../../packages/testing/src/fixtures/learner.ts";
import { learningEventFixture } from "../../../packages/testing/src/fixtures/learning-events.ts";
import { onboardingDraftFixture } from "../../../packages/testing/src/fixtures/onboarding-drafts.ts";
import {
  choiceItemContent,
  itemFixture,
  skillFixture,
} from "../../../packages/testing/src/fixtures/skills.ts";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "../../../packages/testing/src/fixtures/study-sessions.ts";
import { usageRecordsFixture } from "../../../packages/testing/src/fixtures/usage.ts";
import { userFixture } from "../../../packages/testing/src/fixtures/users.ts";
import { MS_PER_DAY } from "../../../packages/utils/src/date.ts";
import { isJsonObject } from "../../../packages/utils/src/json.ts";

async function seed(state: string, email: string) {
  const refusal = getTestLearnerRefusal();

  if (refusal) {
    throw new Error(refusal);
  }

  if (!/^persona-[a-z]+-[a-f0-9]+@zoonk\.test$/u.test(email)) {
    throw new Error("Expected a fresh local persona");
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  const goal = await prisma.goal.findFirstOrThrow({
    include: { plan: true },
    where: { userId: user.id },
  });

  const userId = user.id;

  const write = SEEDS[state];

  if (!write) {
    throw new Error(`Unknown scenario fixture: ${state}`);
  }

  return write({ goal, state, userId });
}

type SeedContext = { goal: Goal & { plan: Plan | null }; state: string; userId: string };

async function seedUnderstood({ userId }: SeedContext) {
  const draft = await onboardingDraftFixture({ userId });
  return `/start?draft=${draft.id}`;
}

async function seedPaused({ userId }: SeedContext) {
  await prisma.goal.updateMany({ data: { status: "paused" }, where: { userId } });
  return "/today";
}

async function seedFailedPlan({ goal }: SeedContext) {
  await prisma.plan.update({
    data: { buildFailedAt: new Date(), graph: {}, phases: [] },
    where: { goalId: goal.id },
  });

  await prisma.planItem.deleteMany({ where: { plan: { goalId: goal.id } } });
  const details = isJsonObject(goal.details) ? goal.details : {};
  const answered = Array.isArray(details.answered) ? details.answered : [];

  await prisma.goal.update({
    data: {
      details: { ...details, answered: [...new Set([...answered, ...PROFILE_QUESTIONS])] },
      generationRunId: crypto.randomUUID(),
      planRevealedAt: null,
    },
    where: { id: goal.id },
  });

  return `/start/${goal.id}`;
}

async function seedGoalLimit({ goal, userId }: SeedContext) {
  const owner = await userFixture();

  const sharedGoal = await goalFixture({
    primaryCourseId: goal.primaryCourseId,
    status: "paused",
    title: "Shared statistics plan",
    userId: owner.id,
  });

  const shared = await planFixture({
    goalId: sharedGoal.id,
    graph: isJsonObject(goal.plan?.graph) ? goal.plan.graph : {},
    phases: Array.isArray(goal.plan?.phases) ? goal.plan.phases : [],
  });

  const count = await prisma.goal.count({ where: { status: "active", userId } });

  await Promise.all(
    Array.from(
      { length: Math.max(0, (getActiveGoalLimit("free") ?? 0) - count) },
      async (_, index) => {
        const added = await goalFixture({ title: `Following ${index + 1}`, userId });
        return planFixture({ goalId: added.id });
      },
    ),
  );

  return `/plan-link/${shared.id}`;
}

async function seedSuggested({ userId }: SeedContext) {
  const course = await prisma.course.findFirstOrThrow();
  await prisma.goal.deleteMany({ where: { userId } });
  await suggestedGoalFixture({ courseId: course.id, title: "Physics", userId });
  return "/today";
}

async function seedUploads({ userId }: SeedContext) {
  const count = getUsageRule({ kind: "upload", tier: "free" }).rolling30Days ?? 0;

  await usageRecordsFixture({
    count,
    createdAt: new Date(Date.now() - MS_PER_DAY),
    kind: "upload",
    userId,
  });

  return "/start";
}

async function seedTwoPractice({ goal, userId }: SeedContext) {
  await prisma.studySession.deleteMany({ where: { userId } });

  const session = await studySessionFixture({
    goalId: goal.id,
    planVersion: goal.plan?.version,
    userId,
  });

  await Promise.all(
    [0, 1].map((position) =>
      studySessionBlockFixture({
        estimatedMinutes: 3,
        kind: "practice",
        payload: { goalId: goal.id, itemIds: [], title: "Practice" },
        position,
        sessionId: session.id,
      }),
    ),
  );

  return "/today";
}

async function seedUnit({ state, userId }: SeedContext) {
  const language = await languageGoalFixture({ userId });

  await prisma.userLearningProfile.update({
    data: { activeGoalId: language.goal.id },
    where: { userId },
  });

  if (state === "unit") {
    await prisma.planItem.updateMany({
      data: { completedAt: new Date(), status: "done" },
      where: { phase: 0, planId: language.plan.id },
    });

    return `/content/units/${language.arriving.id}`;
  }

  const conversation = await prisma.languageConversation.create({
    data: {
      chapterId: language.renting.id,
      goalId: language.goal.id,
      kind: "practice",
      language: "en",
      level: "A2",
      minutes: 2,
      scenario: RENTING_SCENARIO,
      targetLanguage: "en",
      titleSnapshot: RENTING_SCENARIO.title,
      userId,
    },
  });

  return `/conversation/${conversation.id}`;
}

async function seedChallenge({ goal, state, userId }: SeedContext) {
  const boss = await prisma.planItem.findFirstOrThrow({
    orderBy: { position: "asc" },
    where: { kind: "boss", plan: { goalId: goal.id } },
  });

  if (state === "lost") {
    await prisma.studySession.deleteMany({ where: { userId } });

    const session = await studySessionFixture({
      goalId: goal.id,
      planVersion: goal.plan?.version,
      userId,
    });

    const block = await studySessionBlockFixture({
      kind: "checkpoint",
      payload: {
        checkpoint: {
          kind: "boss",
          mock: false,
          passMark: 7,
          phase: boss.phase,
          timeLimitMinutes: null,
        },
        planItemId: boss.id,
      },
      sessionId: session.id,
      status: "completed",
    });

    await learningEventFixture({
      contentIds: {
        planItemId: boss.id,
        studySessionBlockId: block.id,
        studySessionId: session.id,
      },
      correctAnswers: 0,
      incorrectAnswers: 10,
      kind: "checkpoint",
      userId,
    });
  }

  return `/challenge/${boss.id}`;
}

async function seedMistakes({ goal, userId }: SeedContext) {
  const planItem = await prisma.planItem.findFirstOrThrow({
    where: { plan: { goalId: goal.id }, skillId: { not: null } },
  });

  const skill = await prisma.skill.findUniqueOrThrow({ where: { id: planItem.skillId ?? "" } });
  const item = await itemFixture({ skillId: skill.id });
  await mistakeFixture({ itemId: item.id, skillId: skill.id, userId });
  return "/mistakes";
}

async function seedMock({ goal, userId }: SeedContext) {
  const skill = await skillFixture();

  const item = await itemFixture({
    content: choiceItemContent("What is two plus two?"),
    skillId: skill.id,
  });

  const mock = await prisma.mockExam.create({
    data: {
      conditions: {
        day: null,
        examQuestions: null,
        fullLength: true,
        partialCredit: "allOrNothing",
        purpose: "practice",
        reused: 0,
        scoring: "raw",
        sections: [
          {
            essays: [],
            itemIds: [item.id],
            minutes: 60,
            name: "Mathematics",
            questions: 1,
            routing: null,
          },
        ],
        shape: { area: null, day: null, kind: "full" },
        startTime: null,
        timeZone: null,
        timedOutSections: [],
        wrongPenalty: 1,
      },
      goalId: goal.id,
      sectionStartedAt: new Date(),
      userId,
    },
  });

  return `/mock/${mock.id}`;
}

const SEEDS: Record<string, (context: SeedContext) => Promise<string>> = {
  call: seedUnit,
  challenge: seedChallenge,
  "failed-plan": seedFailedPlan,
  "goal-limit": seedGoalLimit,
  lost: seedChallenge,
  mistakes: seedMistakes,
  mock: seedMock,
  paused: seedPaused,
  suggested: seedSuggested,
  "two-practice": seedTwoPractice,
  understood: seedUnderstood,
  unit: seedUnit,
  uploads: seedUploads,
};

try {
  console.log(JSON.stringify({ path: await seed(process.argv[2] ?? "", process.argv[3] ?? "") }));
} finally {
  await prisma.$disconnect();
}
