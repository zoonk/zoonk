import { randomUUID } from "node:crypto";
import { type GoalKind } from "@zoonk/db";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { goalFixture, planFixture, planItemFixture } from "./goals";
import { libraryChapterFixture } from "./library-chapters";
import { chapterLessonFixture, lessonSkillFixture, libraryLessonFixture } from "./library-lessons";
import { skillFixture, skillPrerequisiteFixture } from "./skills";
import { examBlueprintFixture } from "./sources";

const AREA = "Biology";
const LESSONS_PER_SKILL = 3;
const SHORT_DAILY_MINUTES = 15;

/** The graph's size for each skill: far more than a short daily time covers in a month. */
const GRAPH_LESSONS = 40;

/** What the goal values most, each built on a base worth less to it. */
const TOPICS = [
  { base: "Cell structure", name: "Heredity" },
  { base: "Living things", name: "Ecology" },
] as const;

/**
 * A skill placement settled, so the plan has an item when it's handed over and its first read
 * (Today's, the API's) builds it, as after onboarding.
 */
const SETTLED = "Scientific method";

/** Bases first, as the graph teaches prerequisites before what builds on them. */
const SKILL_NAMES = [
  SETTLED,
  ...TOPICS.map((topic) => topic.base),
  ...TOPICS.map((topic) => topic.name),
];

function frequency({ level, topic }: { level: "high" | "low"; topic: string }) {
  return {
    appearances: null,
    basis: "Past papers",
    citation: { passage: topic, sourceId: "papers" },
    level,
    subject: AREA,
    topic,
  };
}

/** A biology exam that asks heredity and ecology a lot, and cell structure and living things less. */
function biologyExamFixture() {
  return examBlueprintFixture({
    name: "Biology exam",
    structure: {
      formats: [],
      mock: null,
      rules: [],
      subjects: [
        {
          citation: { passage: AREA, sourceId: "notice" },
          name: AREA,
          questions: null,
          topics: SKILL_NAMES,
          weight: null,
        },
      ],
    },
    topicFrequency: [
      frequency({ level: "high", topic: SETTLED }),
      ...TOPICS.map((topic) => frequency({ level: "low", topic: topic.base })),
      ...TOPICS.map((topic) => frequency({ level: "high", topic: topic.name })),
    ],
  });
}

/** A skill with three short Library lessons in the chapter, after the skills before it. */
async function createSkill({
  chapterId,
  index,
  name,
}: {
  chapterId: string;
  index: number;
  name: string;
}) {
  // The bases come from an easier band than the topics built on them, as a goal's foundations do.
  const isBase = TOPICS.some((topic) => topic.base === name);
  const level = isBase ? "beginner" : "intermediate";
  const skill = await skillFixture({ level, name: `${name} ${randomUUID()}` });

  const lessons = await Promise.all(
    Array.from({ length: LESSONS_PER_SKILL }, (_, lessonIndex) =>
      libraryLessonFixture({
        estimatedMinutes: 3,
        homeChapterId: chapterId,
        title: `${name} ${lessonIndex + 1} ${randomUUID()}`,
      }),
    ),
  );

  await Promise.all(
    lessons.flatMap((lesson, position) => [
      chapterLessonFixture({
        chapterId,
        lessonId: lesson.id,
        position: index * LESSONS_PER_SKILL + position,
      }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    ]),
  );

  return { name, skillId: skill.id };
}

/**
 * A goal `days` away whose plan builds on bases, as the goal-driven workflow writes it (its graph,
 * not built yet, with the scientific method placement settled): an exam asks heredity and ecology
 * a lot and their bases (cell structure, living things) less; any other goal's outcome skills are
 * heredity and ecology. All in one area, each skill with three short Library lessons and a graph
 * sized far beyond a short daily time.
 */
export async function goalWithBasesFixture({
  dailyMinutes = SHORT_DAILY_MINUTES,
  days,
  details = {},
  kind,
  userId,
}: {
  dailyMinutes?: number;
  days: number;
  /** Adds to what onboarding stored on the goal, such as the questions it answered. */
  details?: Record<string, unknown>;
  kind: Extract<GoalKind, "exam" | "learn">;
  userId: string;
}) {
  const isExam = kind === "exam";

  const [chapter, blueprint] = await Promise.all([
    libraryChapterFixture({ title: AREA }),
    isExam ? biologyExamFixture() : null,
  ]);

  const skills = await Promise.all(
    SKILL_NAMES.map((name, index) => createSkill({ chapterId: chapter.id, index, name })),
  );

  const byName = new Map(skills.map((skill) => [skill.name, skill.skillId]));
  const topicNames = new Set<string>(TOPICS.map((topic) => topic.name));

  const goal = await goalFixture({
    dailyMinutes,
    details: { placementDeclined: true, ...details },
    examBlueprintId: blueprint?.id ?? null,
    kind,
    targetDate: new Date(toUTCMidnight(new Date()).getTime() + days * MS_PER_DAY),
    timezone: "UTC",
    title: isExam ? "Biology exam" : "Understand biology",
    userId,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: isExam ? null : "Explain how life works", name: AREA }],
      skills: skills.map((skill) => ({
        area: AREA,
        lessons: GRAPH_LESSONS,
        name: skill.name,
        outcome: !isExam && topicNames.has(skill.name),
        phase: 0,
        skillId: skill.skillId,
        topics: isExam ? [skill.name] : undefined,
        weight: null,
      })),
    },
    phases: [],
  });

  await Promise.all([
    planItemFixture({
      completedAt: new Date(),
      kind: "lesson",
      planId: plan.id,
      position: 0,
      skillId: byName.get(SETTLED) ?? null,
      status: "testedOut",
      titleSnapshot: SETTLED,
    }),
    ...TOPICS.map((topic) =>
      skillPrerequisiteFixture({
        prerequisiteId: byName.get(topic.base) ?? "",
        skillId: byName.get(topic.name) ?? "",
      }),
    ),
  ]);

  return {
    area: AREA,
    bases: TOPICS.map((topic) => ({ name: topic.base, skillId: byName.get(topic.base) ?? "" })),
    goal,
    plan,
  };
}
