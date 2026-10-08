import { prisma } from "@zoonk/db";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getCheckpoint } from "../../checkpoints/get-checkpoint";
import { getMock } from "../../exams/mocks/get-mock";
import { learnerGoalFixture } from "../../learner/_test-utils/learner-goal";
import { getGoalPlacement } from "../../learner/placement/get-goal-placement";
import { getChapterTestOut } from "../../learner/test-out/get-chapter-test-out";
import { mistakeListInputSchema } from "../../mistakes/contract";
import { getMistakePractice } from "../../mistakes/get-mistake-practice";
import { listCurrentUserMistakes } from "../../mistakes/list-current-user-mistakes";
import { statementContent } from "../../sessions/_test-utils/session-goal";
import { getStudyBlock } from "../../sessions/get-study-block";
import { type ExamStructure } from "./blueprint-contract";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const CITATION = { passage: "Conforme o edital.", sourceId: "notice" };

type ExamFormat = ExamStructure["formats"][number]["kind"];
type ScoringMethod = NonNullable<ExamStructure["mock"]>["scoring"]["method"];

function examStructure({ format, method }: { format: ExamFormat; method: ScoringMethod }) {
  return {
    formats: [
      { citation: CITATION, description: "Como as questões são", kind: format, options: null },
    ],
    mock: {
      adaptive: false,
      citations: [CITATION],
      order: null,
      scoring: { description: "Como a prova é corrigida", method },
      sections: [],
      timeLimitMinutes: 180,
      totalQuestions: 120,
    },
    rules: [],
    subjects: [],
  } satisfies ExamStructure;
}

const BOSS = {
  kind: "boss",
  mock: false,
  passMark: 1,
  phase: 0,
  rematch: false,
  timeLimitMinutes: null,
} as const;

/**
 * An exam goal whose plan has one chapter, with a statement on its first skill that today's session
 * asks in practice, in the phase's boss and in the weekly mock.
 */
async function examGoal(structure: ExamStructure) {
  const user = await userFixture();

  const [blueprint, fixture] = await Promise.all([
    examBlueprintFixture({ structure }),
    learnerGoalFixture({ itemsPerSkill: 1, phases: [2], userId: user.id }),
  ]);

  const goalId = fixture.goal.id;
  const skillId = fixture.skills[0]?.id ?? "";

  const [statement, session] = await Promise.all([
    itemFixture({ content: statementContent(true), format: "trueFalse", skillId }),
    studySessionFixture({ goalId, userId: user.id }),
    prisma.goal.update({
      data: { examBlueprintId: blueprint.id, kind: "exam" },
      where: { id: goalId },
    }),
  ]);

  const asks = { itemIds: [statement.id], skillIds: [skillId] };
  const sessionId = session.id;

  const [practice, boss, mock] = await Promise.all([
    studySessionBlockFixture({ kind: "practice", payload: asks, position: 0, sessionId }),
    studySessionBlockFixture({
      kind: "checkpoint",
      payload: { ...asks, checkpoint: BOSS },
      position: 1,
      sessionId,
    }),
    studySessionBlockFixture({
      kind: "checkpoint",
      payload: { ...asks, checkpoint: { ...BOSS, kind: "weekly", mock: true } },
      position: 2,
      sessionId,
    }),
  ]);

  mockSession(user.id);

  return {
    blocks: { boss, mock, practice },
    chapterId: fixture.chapters[0]?.id ?? "",
    goalId,
    sessionId,
  };
}

describe.each([
  {
    exam: "a Cebraspe exam, where a wrong answer cancels a right one, are judged right or wrong",
    labels: "rightWrong",
    scoring: "net",
    structure: examStructure({ format: "trueFalse", method: "wrongCancelsRight" }),
  },
  {
    exam: "an ENEM-style exam stay true or false",
    labels: "trueFalse",
    scoring: "irt",
    structure: examStructure({ format: "multipleChoice", method: "itemResponseTheory" }),
  },
])("statements of $exam", ({ labels, scoring, structure }) => {
  it("in placement, the chapter test-out and the mistakes notebook", async () => {
    const { chapterId, goalId } = await examGoal(structure);

    const [placement, testOut, notebook, practice] = await Promise.all([
      getGoalPlacement({ goalId }),
      getChapterTestOut({ chapterId, goalId }),
      listCurrentUserMistakes(mistakeListInputSchema.parse({ goalId })),
      getMistakePractice({ goalId }),
    ]);

    expect(placement).toMatchObject({ placement: { trueFalseLabels: labels }, status: "ready" });
    expect(testOut).toMatchObject({ status: "ready", testOut: { trueFalseLabels: labels } });
    expect(notebook).toMatchObject({ status: "ready", trueFalseLabels: labels });
    expect(practice).toMatchObject({ status: "ready", trueFalseLabels: labels });
  });

  it("in a session's practice, the phase's boss and the weekly mock, scored as the exam is", async () => {
    const { blocks, sessionId } = await examGoal(structure);

    const [practice, boss, mock] = await Promise.all([
      getStudyBlock({ blockId: blocks.practice.id, sessionId }),
      getCheckpoint(blocks.boss.id),
      getMock(blocks.mock.id),
    ]);

    expect(practice).toMatchObject({ detail: { trueFalseLabels: labels }, status: "ready" });
    expect(boss).toMatchObject({ checkpoint: { trueFalseLabels: labels }, status: "ready" });
    expect(mock).toMatchObject({ mock: { scoring, trueFalseLabels: labels }, status: "ready" });
  });
});

// Rafaela's Câmara goal (Cebraspe) asked "Verdadeiro ou falso" until its notice's blueprint linked,
// though the first pass over the notice had read "CERTO ou ERRADO".
describe("statements of an exam whose notice is still being read", () => {
  it("are judged right or wrong from the first question when its first reading names them so", async () => {
    const { blocks, goalId, sessionId } = await examGoal(
      examStructure({ format: "trueFalse", method: "wrongCancelsRight" }),
    );

    const noticeFormats = [
      {
        citation: {
          passage: "O julgamento de cada item será CERTO ou ERRADO, de acordo com o comando.",
          sourceId: "notice",
        },
        description: "Itens para julgamento individual entre certo ou errado",
        kind: "trueFalse",
        options: null,
      },
    ];

    await prisma.goal.update({
      data: { details: { noticeFormats }, examBlueprintId: null },
      where: { id: goalId },
    });

    const [placement, practice] = await Promise.all([
      getGoalPlacement({ goalId }),
      getStudyBlock({ blockId: blocks.practice.id, sessionId }),
    ]);

    expect(placement).toMatchObject({
      placement: { trueFalseLabels: "rightWrong" },
      status: "ready",
    });

    expect(practice).toMatchObject({ detail: { trueFalseLabels: "rightWrong" }, status: "ready" });
  });
});

describe("the notebook across every goal", () => {
  it("keeps statements true or false, since no one exam's words apply", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await expect(listCurrentUserMistakes(mistakeListInputSchema.parse({}))).resolves.toMatchObject({
      status: "ready",
      trueFalseLabels: "trueFalse",
    });
  });
});
