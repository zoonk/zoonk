import { type Goal, type StudySession, type StudySessionBlock, prisma } from "@zoonk/db";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { type FixtureAttrs } from "./_utils/fixture-attrs";
import { goalFixture, planFixture, planItemFixture } from "./goals";
import { learningProfileFixture } from "./learning-profiles";
import { libraryChapterFixture } from "./library-chapters";
import { chapterLessonFixture, lessonSkillFixture, libraryLessonFixture } from "./library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "./skills";

const DEFAULT_PLANNED_MINUTES = 20;
const FIRST_INTERVIEW_PHASE_DAYS = 8;
const INTERVIEW_PLAN_DAYS = 41;

/** Creates today's planned study session for a learner. */
export async function studySessionFixture(
  attrs: FixtureAttrs<StudySession, "startSnapshot" | "endSnapshot" | "missions"> &
    Pick<StudySession, "userId">,
) {
  const { missions = { picks: [], version: 1 }, ...data } = attrs;

  return prisma.studySession.create({
    data: {
      localDate: toUTCMidnight(new Date()),
      missions,
      plannedMinutes: DEFAULT_PLANNED_MINUTES,
      ...data,
    },
  });
}

/**
 * Creates a session block. Without a position it goes after the session's current blocks; tests that
 * add several blocks in parallel should pass positions.
 */
export async function studySessionBlockFixture(
  attrs: FixtureAttrs<StudySessionBlock, "payload"> & Pick<StudySessionBlock, "sessionId">,
) {
  const position =
    attrs.position ??
    (await prisma.studySessionBlock.count({ where: { sessionId: attrs.sessionId } }));

  return prisma.studySessionBlock.create({ data: { kind: "learn", ...attrs, position } });
}

/** One written lesson per skill, with real questions and lesson-skill links. */
export async function studySessionPlanFixture({
  goal,
  itemsPerSkill = 3,
  lessons = 3,
}: {
  goal: Goal;
  itemsPerSkill?: number;
  lessons?: number;
}) {
  const plan = await planFixture({
    goalId: goal.id,
    phases: [{ name: "Basics" }, { name: "Practice" }],
  });

  const skills = await Promise.all(
    Array.from({ length: lessons }, (_, index) => skillFixture({ name: `Skill ${index + 1}` })),
  );

  const lessonRows = await Promise.all(
    skills.map((_, index) =>
      libraryLessonFixture({ canDo: `You'll do thing ${index + 1}`, title: `Lesson ${index + 1}` }),
    ),
  );

  const [planItems, items] = await Promise.all([
    Promise.all(
      lessonRows.map((lesson, position) =>
        planItemFixture({
          kind: "lesson",
          lessonId: lesson.id,
          phase: 0,
          planId: plan.id,
          position,
          titleSnapshot: lesson.title,
        }),
      ),
    ),
    Promise.all(
      skills.flatMap((skill) =>
        Array.from({ length: itemsPerSkill }, () =>
          itemFixture({ content: choiceItemContent(), skillId: skill.id }),
        ),
      ),
    ),
    Promise.all(
      lessonRows.map((lesson, index) =>
        lessonSkillFixture({ lessonId: lesson.id, skillId: skills[index]?.id ?? "" }),
      ),
    ),
  ]);

  return { goal, items, lessons: lessonRows, plan, planItems, skills };
}

/** DB-only preconditions for a Plus call with free next-phase work after entitlement lapses. */
export async function plusCallDayFixture({
  localDate,
  userId,
}: {
  localDate: Date;
  userId: string;
}) {
  const goal = await goalFixture({
    dailyMinutes: 6,
    details: { placementDeclined: true },
    kind: "language",
    targetLanguage: "en",
    timezone: "UTC",
    userId,
  });

  const fixture = await studySessionPlanFixture({ goal });
  const later = fixture.planItems.at(-1);

  if (!later) {
    throw new Error("Expected the actual next-phase lesson");
  }

  await prisma.planItem.updateMany({
    data: { status: "done" },
    where: { planId: fixture.plan.id },
  });

  await prisma.planItem.update({
    data: { phase: 1, position: 5, status: "todo" },
    where: { id: later.id },
  });

  const [boss, subscription] = await Promise.all([
    planItemFixture({
      kind: "boss",
      phase: 0,
      planId: fixture.plan.id,
      position: 2,
      scheduledFor: localDate,
      titleSnapshot: "Test boss",
    }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: userId, status: "active" },
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId }),
  ]);

  return { ...fixture, boss, subscription };
}

/** DB-only inputs for a real plan build; a missing saved boss is later selected with a null ID. */
export async function unplannedCheckpointFixture({ userId }: { userId: string }) {
  const goal = await goalFixture({ dailyMinutes: 12, timezone: "UTC", userId });

  const [plan, chapter, skill] = await Promise.all([
    planFixture({ goalId: goal.id, phases: [] }),
    libraryChapterFixture({ title: "Basics chapter 1" }),
    skillFixture({ name: "Planned checkpoint skill" }),
    learningProfileFixture({ activeGoalId: goal.id, userId }),
  ]);

  const lessons = await Promise.all(
    Array.from({ length: 4 }, async (_, position) => {
      const lesson = await libraryLessonFixture({ estimatedMinutes: 3, homeChapterId: chapter.id });

      await Promise.all([
        chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
        lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
      ]);

      return lesson;
    }),
  );

  return {
    chapter,
    goal,
    graph: {
      phases: [{ milestone: "Can do Basics", name: "Basics" }],
      skills: [
        { area: null, lessons: 4, name: skill.name, phase: 0, skillId: skill.id, weight: null },
      ],
    },
    lessons,
    plan,
    skill,
  };
}

/** Days to an at-risk goal's date: too few for its 72 lessons at 12 minutes a day. */
const AT_RISK_DAYS = 7;

/**
 * DB-only prior-day unwritten work: the read must settle it in memory, which moves a phase's end.
 * No notice, proposal, session or authored lesson is fabricated. At risk (`atRisk`), the goal has
 * a date its plan covered all of when it was last planned, which the missed day loses: Today asks
 * the learner what to do about it.
 */
export async function mandatoryNoticeDayFixture({
  atRisk = false,
  localDate,
  userId,
}: {
  atRisk?: boolean;
  localDate: Date;
  userId: string;
}) {
  const day = toUTCMidnight(localDate);
  const prior = new Date(day.getTime() - MS_PER_DAY);
  const before = new Date(prior.getTime() + FIRST_INTERVIEW_PHASE_DAYS * MS_PER_DAY);
  const later = new Date(prior.getTime() + (FIRST_INTERVIEW_PHASE_DAYS + 1) * MS_PER_DAY);
  const end = new Date(prior.getTime() + INTERVIEW_PLAN_DAYS * MS_PER_DAY);
  const phaseName = "First interviews";

  const [opening, followup] = await Promise.all([
    skillFixture({ name: "Opening the interview" }),
    skillFixture({ name: "Follow-up questions" }),
  ]);

  const skills = [opening, followup];

  const goal = await goalFixture({
    createdAt: new Date(prior.getTime() + 12 * 60 * 60 * 1000),
    dailyMinutes: 12,
    details: { placementDeclined: true },
    kind: "learn",
    targetDate: atRisk ? new Date(day.getTime() + AT_RISK_DAYS * MS_PER_DAY) : null,
    timezone: "UTC",
    title: "Interview practice",
    userId,
  });

  const phases = [
    {
      endDate: before.toISOString().slice(0, 10),
      kind: "learn",
      milestone: null,
      name: phaseName,
      startDate: prior.toISOString().slice(0, 10),
    },
    {
      endDate: end.toISOString().slice(0, 10),
      kind: "learn",
      milestone: null,
      name: "Practice",
      startDate: later.toISOString().slice(0, 10),
    },
  ];

  const plan = await planFixture({
    coveredShare: atRisk ? 1 : null,
    createdAt: goal.createdAt,
    goalId: goal.id,
    graph: {
      phases: [
        { milestone: null, name: phaseName },
        { milestone: null, name: "Practice" },
      ],
      skills: skills.map((skill, phase) => ({
        area: "Interviews",
        lessons: phase === 0 ? 12 : 60,
        name: skill.name,
        phase,
        skillId: skill.id,
        weight: null,
      })),
    },
    phases,
    settings: {
      pace: { factor: 1, source: "typical" },
      startDate: prior.toISOString().slice(0, 10),
      weekdayMinutes: Array.from({ length: 7 }, (_, weekday) =>
        weekday === day.getUTCDay() ? 0 : 12,
      ),
    },
  });

  const items = await Promise.all([
    planItemFixture({
      kind: "lesson",
      phase: 0,
      planId: plan.id,
      position: 0,
      scheduledFor: prior,
      skillId: opening.id,
      titleSnapshot: opening.name,
    }),
    planItemFixture({
      kind: "boss",
      phase: 0,
      planId: plan.id,
      position: 1,
      scheduledFor: before,
      titleSnapshot: phaseName,
    }),
    planItemFixture({
      kind: "lesson",
      phase: 1,
      planId: plan.id,
      position: 2,
      scheduledFor: later,
      skillId: followup.id,
      titleSnapshot: followup.name,
    }),
    planItemFixture({
      kind: "boss",
      phase: 1,
      planId: plan.id,
      position: 3,
      scheduledFor: end,
      titleSnapshot: "Practice",
    }),
  ]);

  await learningProfileFixture({ activeGoalId: goal.id, userId });
  return { before, goal, items, localDate: day, phaseName, plan, prior, skills };
}
