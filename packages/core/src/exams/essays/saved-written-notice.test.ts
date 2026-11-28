import { prisma } from "@zoonk/db";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getWritingSkillIds } from "../../learner/writing-skills";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import { buildExamIdentityKey } from "../../library/exams/exam-identity";
import { readBlueprintContent, saveExamBlueprint } from "../../library/exams/save-exam-blueprint";
import { findTaskSubjects } from "../../library/exams/written-task-subjects";
import { listWrittenTasks } from "../../library/exams/written-tasks";
import { planLibraryFixture, unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";
import { loadGoalPreparation } from "../../preparation/_utils/load-goal-preparation";
import { getTodayStudySession } from "../../sessions/_test-utils/open-today";
import {
  listWrittenBlueprintRepairs,
  listWrittenGoalRepairs,
} from "../../staff/repair-written-preparation";
import { getSyllabusView } from "../../view-models/syllabus/get-syllabus-view";
import reading from "../choices/_test-utils/cgu-2026-structure.json";
import { CGU_WRITTEN_GRADING } from "../mocks/_test-utils/cgu-written";
import { getMockOptions } from "../mocks/get-mock-options";
import { startAnytimeMock } from "../mocks/start-anytime-mock";
import { createWritingBlock } from "./create-writing-block";
import { startWriting } from "./start-writing";

const NOW = new Date("2026-11-08T12:00:00Z");
const P2 = "Conhecimentos complementares (P2)";
const SYSTEMS = "Tecnologia da Informação – Desenvolvimento de Sistemas";
const CHOICE = { group: "Especialidade", subjects: [SYSTEMS] };
const NEEDS_CHOICE = { choiceGroups: [CHOICE.group], status: "needsChoice" };
const FIXTURE_ID_PREFIX = "ffffffff-ffff-7fff-bfff-";
const FIXTURE_IDS_START = `${FIXTURE_ID_PREFIX}000000000000`;

const LEARNER_STATES = [
  { choice: false, reread: false, scale: "levels" },
  { choice: true, reread: false, scale: "levels" },
  { choice: false, reread: true, scale: "points" },
  { choice: true, reread: true, scale: "points" },
];

const WRITTEN = { area: null, day: null, kind: "written" } as const;

const SAVED = examStructureSchema.parse(reading);

function rereadStructure(structure: ExamStructure, reword = false): ExamStructure {
  const next = structuredClone(structure);

  for (const section of next.mock?.sections ?? []) {
    if (section.kind === "objective") {
      section.session = "morning";
    }

    if (section.kind === "written") {
      section.session = "afternoon";

      section.tasks = section.tasks?.map((task, index) => {
        const short = index === 0;
        const factor = short ? 6 : 12;
        const revisedDescription = short ? "Questão discursiva" : "Situação-problema";

        return {
          ...task,
          description: reword ? revisedDescription : task.description,
          grading: {
            ...CGU_WRITTEN_GRADING,
            criteria: [{ ...CGU_WRITTEN_GRADING.criteria[0], points: short ? 30 : 70 }],
            language: {
              citation: { passage: "Deduct for errors per written line.", sourceId: "notice" },
              factor,
              formula: `${factor} × NE / TL`,
              method: "errorsPerLine",
              text: "Deduct for errors per written line.",
            },
          },
          lines: short ? 30 : 60,
          points: short ? 30 : 70,
          subjects: findTaskSubjects({
            names: [short ? P2 : CHOICE.group],
            subjects: structure.subjects,
          }).map(({ name }) => name),
        };
      });
    }
  }

  return next;
}

async function setup({ choice, reread }: { choice: boolean; reread: boolean }) {
  const identity = {
    board: "Cebraspe",
    country: "BR",
    language: "pt",
    name: "CGU",
    ownerId: null,
    role: `Auditor Federal de Finanças e Controle ${crypto.randomUUID()}`,
  };

  const source = await sourceFixture();

  let blueprint = await examBlueprintFixture({
    ...identity,
    id: `${FIXTURE_ID_PREFIX}${crypto.randomUUID().slice(-12)}`,
    identityKey: buildExamIdentityKey(identity),
    sourceId: source.id,
    structure: SAVED,
  });

  const read = (structure: ExamStructure) =>
    saveExamBlueprint({
      content: { ...readBlueprintContent(blueprint), structure },
      identity,
      provenance: {
        generatedAt: NOW,
        model: "fixture",
        promptVersion: "fixture",
        runId: "fixture",
      },
      reread: true,
      sourceId: source.id,
    });

  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({
      skills: SAVED.subjects.flatMap(({ name, choiceGroup }) => {
        if (name === "Prova discursiva") {
          return Array.from({ length: 3 }, () => ({ area: name, lessons: 4, weight: 1 / 6 }));
        }

        return choiceGroup && name !== SYSTEMS ? [] : [{ area: name, lessons: 4 }];
      }),
    }),
  ]);

  if (reread) {
    const first = await read(rereadStructure(SAVED));

    const second = await read(
      rereadStructure(readBlueprintContent(first.blueprint).structure, true),
    );

    blueprint = second.blueprint;
  }

  const { structure } = readBlueprintContent(blueprint);
  const tasks = listWrittenTasks({ structure });

  expect(tasks.map(({ key }) => key)).toStrictEqual(
    listWrittenTasks({ structure: SAVED }).map(({ key }) => key),
  );

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 240,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    id: `${FIXTURE_ID_PREFIX}${crypto.randomUUID().slice(-12)}`,
    kind: "exam",
    language: "pt",
    settings: { examChoices: choice ? [CHOICE] : [], startDate: "2026-11-08" },
    targetDate: new Date("2026-12-13"),
    timezone: "UTC",
    userId: user.id,
  });

  mockSession(user.id);

  await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
    status: "created",
  });

  return {
    blueprint,
    goal,
    structure,
    tasks,
    user,
    written: library.graph.skills.filter(({ area }) => area === "Prova discursiva"),
  };
}

describe("written preparation for the saved CGU notice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it.each(LEARNER_STATES)(
    "keeps the exam and practice readable with choice=$choice and reread=$reread",
    async ({ choice, reread, scale }) => {
      const { goal, structure, tasks, user, written } = await setup({ choice, reread });

      const positions = [
        { lines: 30, points: 30 },
        { lines: 60, points: 70 },
      ].map(({ lines, points }, index) => ({
        distinctLines: reread,
        lines: reread ? lines : null,
        number: index + 1,
        points: reread ? points : null,
        total: 2,
      }));

      expect(tasks).toHaveLength(2);

      const [short, long] = tasks;

      if (!short || !long) {
        throw new Error("Expected both written questions");
      }

      const [plan, syllabus, options, preparation] = await Promise.all([
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
        getSyllabusView({ goalId: goal.id }),
        getMockOptions({ goalId: goal.id }),
        loadGoalPreparation({ goalId: goal.id }),
      ]);

      expect(syllabus).toMatchObject({
        syllabus: {
          writtenPractice: {
            subjects: [
              {
                minutes: 210,
                questions: 2,
                scale,
                share: 0.5,
                ...(!choice && { availability: NEEDS_CHOICE }),
                writeActions: [
                  {
                    availability: { status: "available" },
                    taskKey: short.key,
                    writingTask: positions[0],
                  },
                  {
                    availability: choice ? { status: "available" } : NEEDS_CHOICE,
                    taskKey: long.key,
                    writingTask: positions[1],
                  },
                ],
              },
            ],
          },
        },
      });

      if (options.status !== "ready") {
        throw new Error(options.status);
      }

      const { options: mocks } = options.view;
      const objective = mocks.find(({ kind }) => kind === "objective");
      expect(objective).toMatchObject({ minutes: 300, questions: 170 });

      expect(
        objective?.areas.filter((area) =>
          SAVED.subjects.some(
            ({ name, choiceGroup }) => name === area && choiceGroup === CHOICE.group,
          ),
        ),
      ).toStrictEqual(choice ? [SYSTEMS] : []);

      const availability = choice ? {} : { availability: NEEDS_CHOICE };

      const writtenSection = {
        ...availability,
        kind: "written",
        questions: 2,
        session: reread ? "afternoon" : null,
      };

      const writtenMock = mocks.find(({ kind }) => kind === "written");
      const fullMock = mocks.find(({ kind }) => kind === "full");

      expect(writtenMock).toMatchObject({
        ...availability,
        minutes: 210,
        sections: [writtenSection],
      });

      expect(fullMock).toMatchObject({
        ...availability,
        minutes: 510,
        sections: [{ questions: 170 }, writtenSection],
      });

      expect(writtenMock?.availability).toStrictEqual(availability.availability);
      expect(fullMock?.availability).toStrictEqual(availability.availability);

      expect(mocks.find(({ kind }) => kind === "half")).toMatchObject({
        minutes: 150,
        objectiveOnly: true,
        questions: 85,
        written: [],
      });

      expect(preparation).toMatchObject({
        preparation: {
          writtenProjection: {
            combined: null,
            objectiveMax: 260,
            parts: [
              {
                max: 100,
                minimum: { unit: "points", value: 50 },
                range: null,
                scale,
                standing: "unmeasured",
                tasks: [
                  { key: short.key, range: null },
                  { key: long.key, range: null },
                ],
              },
            ],
          },
        },
      });

      expect(getWritingSkillIds({ graph: parsePlanGraph(plan.graph), structure })).toStrictEqual(
        new Set(written.map(({ skillId }) => skillId)),
      );

      const schedule = parsePlanSettings(plan.settings).writingSchedule ?? [];

      expect(schedule.filter(({ test }) => test).map(({ minutes }) => minutes)).toStrictEqual(
        choice ? [210, 210] : [],
      );

      const answers = schedule.flatMap(({ tasks: scheduled }) => scheduled);

      expect(new Set(answers.map(({ taskKey }) => taskKey))).toStrictEqual(
        new Set(choice ? [short.key, long.key] : [short.key]),
      );

      expect(answers[0]).toMatchObject({
        minutes: reread ? 70 : 105,
        taskKey: short.key,
        unit: "answer",
      });

      const today = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });

      expect(today).toMatchObject({
        session: {
          blocks: expect.arrayContaining([
            expect.objectContaining({
              kind: "produce",
              writingTask: positions[0],
              writingUnit: "answer",
            }),
          ]),
        },
        status: "ready",
      });

      const block = await createWritingBlock({ goalId: goal.id, taskKey: short.key });

      if (block.status !== "ready") {
        throw new Error(block.status);
      }

      await expect(startWriting({ blockId: block.blockId })).resolves.toMatchObject({
        input: { taskKey: short.key, unit: "answer" },
        status: "needsPrompt",
      });

      const specialtyBlock = await createWritingBlock({ goalId: goal.id, taskKey: long.key });

      const specialtyStart =
        specialtyBlock.status === "ready"
          ? await startWriting({ blockId: specialtyBlock.blockId })
          : specialtyBlock;

      expect(specialtyStart).toMatchObject(
        choice
          ? { input: { taskKey: long.key, unit: "answer" }, status: "needsPrompt" }
          : { status: "notFound" },
      );

      await prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      });

      await expect(
        startAnytimeMock({ goalId: goal.id, input: { shape: WRITTEN } }),
      ).resolves.toMatchObject(choice ? { status: "preparing" } : NEEDS_CHOICE);
    },
  );

  it.each(LEARNER_STATES)(
    "previews repair for objective mastery with choice=$choice and reread=$reread",
    async ({ choice, reread }) => {
      const { blueprint, goal, user, written } = await setup({ choice, reread });

      const [skill] = written;

      if (!skill) {
        throw new Error("Expected a written skill");
      }

      const { skillId } = skill;

      const [item] = await Promise.all([
        itemFixture({ format: "trueFalse", skillId }),
        learnerSkillFixture({ skillId, state: "mastered", userId: user.id }),
      ]);

      await Promise.all(
        Array.from({ length: 3 }, () =>
          attemptFixture({ answer: { value: true }, itemId: item.id, skillId, userId: user.id }),
        ),
      );

      await expect(
        listWrittenBlueprintRepairs({ after: FIXTURE_IDS_START }),
      ).resolves.toMatchObject({
        entries: expect.arrayContaining([
          { blueprintId: blueprint.id, status: reread ? "keyed" : "needsReading" },
        ]),
      });

      await expect(
        listWrittenGoalRepairs({ after: FIXTURE_IDS_START, apply: false }),
      ).resolves.toMatchObject({
        entries: expect.arrayContaining([{ goalId: goal.id, skills: 1, status: "eligible" }]),
      });
    },
  );
});
