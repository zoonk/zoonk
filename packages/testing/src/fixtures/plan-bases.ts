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

const GRAPH_LESSONS = 40;

const TOPICS = [
  { base: "Cell structure", name: "Heredity" },
  { base: "Living things", name: "Ecology" },
] as const;

/** A settled placement gives the plan an item for the first POST to lay out; reads don't. */
const SETTLED = "Scientific method";

/** Bases first, as the graph teaches prerequisites before what builds on them. */
const SKILL_NAMES = [
  SETTLED,
  ...TOPICS.map((topic) => topic.base),
  ...TOPICS.map((topic) => topic.name),
];

function getSubject({ name, subjectPerTopic }: { name: string; subjectPerTopic: boolean }) {
  const topic = TOPICS.find((entry) => entry.name === name || entry.base === name);
  return subjectPerTopic && topic ? topic.name : AREA;
}

function biologyExamFixture({ subjectPerTopic }: { subjectPerTopic: boolean }) {
  const subjectOf = (name: string) => getSubject({ name, subjectPerTopic });

  const frequency = ({ level, topic }: { level: "high" | "low"; topic: string }) => ({
    appearances: null,
    basis: "Past papers",
    citation: { passage: topic, sourceId: "papers" },
    level,
    subject: subjectOf(topic),
    topic,
  });

  return examBlueprintFixture({
    name: "Biology exam",
    structure: {
      formats: [],
      mock: null,
      rules: [],
      subjects: [...Map.groupBy(SKILL_NAMES, subjectOf)].map(([name, topics]) => ({
        citation: { passage: name, sourceId: "notice" },
        name,
        questions: null,
        topics,
        weight: null,
      })),
    },
    topicFrequency: [
      frequency({ level: "high", topic: SETTLED }),
      ...TOPICS.map((topic) => frequency({ level: "low", topic: topic.base })),
      ...TOPICS.map((topic) => frequency({ level: "high", topic: topic.name })),
    ],
  });
}

async function createSkill({
  chapterId,
  index,
  name,
}: {
  chapterId: string;
  index: number;
  name: string;
}) {
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

export async function goalWithBasesFixture({
  dailyMinutes = SHORT_DAILY_MINUTES,
  days,
  details = {},
  kind,
  subjectPerTopic = false,
  userId,
}: {
  dailyMinutes?: number;
  days: number;
  details?: Record<string, unknown>;
  kind: Extract<GoalKind, "exam" | "learn">;
  subjectPerTopic?: boolean;
  userId: string;
}) {
  const isExam = kind === "exam";

  const [chapter, blueprint] = await Promise.all([
    libraryChapterFixture({ title: AREA }),
    isExam ? biologyExamFixture({ subjectPerTopic }) : null,
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
        area: getSubject({ name: skill.name, subjectPerTopic }),
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
    bases: TOPICS.map((topic) => ({
      area: getSubject({ name: topic.base, subjectPerTopic }),
      name: topic.base,
      skillId: byName.get(topic.base) ?? "",
    })),
    goal,
    plan,
  };
}
