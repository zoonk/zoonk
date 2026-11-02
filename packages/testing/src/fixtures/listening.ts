import { randomUUID } from "node:crypto";
import { type ItemSet, prisma } from "@zoonk/db";
import { type FixtureAttrs, fixtureProvenance } from "./_utils/fixture-attrs";
import { goalFixture, planFixture } from "./goals";
import { itemSetFixture, skillFixture } from "./skills";
import { examBlueprintFixture } from "./sources";
import { userFixture } from "./users";

/** A unique line gives each set its own script and reuse key. */
export function listeningContent({
  plays = 1,
  uniqueLine = `My booking number is ${randomUUID()}.`,
}: { plays?: 1 | 2; uniqueLine?: string } = {}) {
  return {
    plays,
    script: {
      speakers: [
        {
          accent: "British English",
          gender: "female",
          key: "Receptionist",
          label: "Receptionist",
          voice: "Kore",
        },
        { accent: "Australian English", gender: "male", key: "Tom", label: "Tom", voice: "Puck" },
      ],
      turns: [
        { speaker: "Receptionist", text: "Good morning, Riverside Sports Centre. How can I help?" },
        { speaker: "Tom", text: `I'd like to book the small hall, please. ${uniqueLine}` },
        { speaker: "Receptionist", text: "Which day were you thinking of?" },
        { speaker: "Tom", text: "Tuesday, no, sorry, Thursday the twelfth." },
      ],
    },
    scriptLanguage: "en",
    task: "Part 1: a conversation between two people in an everyday social context",
    title: "Booking a hall",
  };
}

export function listeningSetFixture(attrs?: FixtureAttrs<ItemSet, "content">) {
  return itemSetFixture({ content: listeningContent(), kind: "audio", ...attrs });
}

const LISTENING_TASKS = [
  {
    count: 2,
    description: "Part 1: a conversation between two people in an everyday social context",
    plays: 1,
  },
  { count: 2, description: "Part 2: one speaker talking about local facilities" },
];

export function listeningBlueprintFixture({ name }: { name: string }) {
  return examBlueprintFixture({
    language: "pt",
    name,
    structure: {
      formats: [],
      mock: {
        adaptive: false,
        citations: [],
        order: null,
        scoring: { description: "Bands", method: "scaled" },
        sections: [
          { day: null, kind: "objective", minutes: 60, name: "Reading", questions: 40, tasks: [] },
          {
            day: null,
            kind: "listening",
            minutes: 30,
            name: "Listening",
            questions: 4,
            tasks: LISTENING_TASKS,
          },
        ],
        timeLimitMinutes: null,
        totalQuestions: 44,
      },
      rules: [],
      subjects: [],
    },
  });
}

export async function listeningExamFixture() {
  const unique = randomUUID();

  const [listeningDetail, listeningGist, reading] = await Promise.all([
    skillFixture({ name: `Note details heard ${unique}` }),
    skillFixture({ name: `Follow a speaker's purpose ${unique}` }),
    skillFixture({ name: `Read for gist ${unique}` }),
  ]);

  const blueprint = await listeningBlueprintFixture({ name: `Listening Exam ${unique}` });

  const graph = {
    phases: [{ milestone: "Exam ready", name: "Base" }],
    skills: [
      { area: "Listening", skill: listeningDetail },
      { area: "Reading", skill: reading },
      { area: "Listening", skill: listeningGist },
    ].map(({ area, skill }) => ({
      area,
      lessons: 2,
      name: skill.name,
      phase: 0,
      skillId: skill.id,
      weight: null,
    })),
  };

  await prisma.examSkillGraph.create({
    data: { examBlueprintId: blueprint.id, generatedAt: new Date(), graph, ...fixtureProvenance() },
  });

  return { blueprint, graph, listeningSkills: [listeningDetail, listeningGist], reading };
}

export async function listeningGoalFixture() {
  const [user, exam] = await Promise.all([userFixture(), listeningExamFixture()]);

  const goal = await goalFixture({
    examBlueprintId: exam.blueprint.id,
    kind: "exam",
    language: "pt",
    targetLanguage: "en",
    title: "IELTS",
    userId: user.id,
  });

  const plan = await planFixture({ goalId: goal.id, graph: exam.graph });

  return { ...exam, goal, plan, user };
}
