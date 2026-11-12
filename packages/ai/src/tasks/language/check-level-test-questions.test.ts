import { describe, expect, it, vi } from "vitest";
import {
  type LevelTestQuestionCheck,
  findLevelTestQuestionProblem,
} from "./check-level-test-questions";

vi.mock("server-only", () => ({}));
vi.mock("./check-level-test-questions.prompt.md", () => ({ default: "Check the questions." }));

const floorQuestion = {
  answerIndex: 2,
  level: "A2" as const,
  options: [
    "The washing machine, from the ground floor to the second floor.",
    "The bicycle room, from the second floor to the ground floor.",
    "The washing machine, from the second floor to the ground floor.",
    "The bicycle room, from the ground floor to the second floor.",
  ],
  passage:
    "Aviso aos moradores: a máquina de lavar ficava no segundo andar. Na semana passada, mudamos a máquina para o térreo.",
  question: "What was moved last week, and between which floors?",
};

function check(overrides: Partial<LevelTestQuestionCheck>): LevelTestQuestionCheck {
  return { leaks: [], literal: true, picks: [2], work: "Settled by the notice.", ...overrides };
}

describe(findLevelTestQuestionProblem, () => {
  it("keeps a question whose check reaches its key", () => {
    expect(findLevelTestQuestionProblem({ check: check({}), question: floorQuestion })).toBeNull();
  });

  it("drops a question with no right option, another right option, or a second one", () => {
    for (const picks of [[], [0], [2, 3]]) {
      expect(
        findLevelTestQuestionProblem({ check: check({ picks }), question: floorQuestion }),
      ).toStrictEqual(expect.any(String));
    }
  });

  it("drops a question that can be answered without its text", () => {
    expect(
      findLevelTestQuestionProblem({ check: check({ leaks: ["form"] }), question: floorQuestion }),
    ).toContain("form");
  });

  it("drops a B2 or C1 question a face-value reading answers, and keeps it below B2", () => {
    expect(
      findLevelTestQuestionProblem({
        check: check({}),
        question: { ...floorQuestion, level: "C1" },
      }),
    ).toContain("C1");

    expect(
      findLevelTestQuestionProblem({
        check: check({ literal: false }),
        question: { ...floorQuestion, level: "C1" },
      }),
    ).toBeNull();
  });

  it("drops a question the check skipped", () => {
    expect(findLevelTestQuestionProblem({ check: null, question: floorQuestion })).toStrictEqual(
      expect.any(String),
    );
  });
});
