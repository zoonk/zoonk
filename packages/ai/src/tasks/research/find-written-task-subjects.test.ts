import { describe, expect, it, vi } from "vitest";
import { CASE, TASK, TIE, reading } from "./_test-utils/written-reading";
import { applyWrittenTaskSubjects, listTaskSubjectInputs } from "./find-written-task-subjects";

vi.mock("server-only", () => ({}));
vi.mock("./find-written-task-subjects.prompt.md", () => ({ default: "Tie tasks to subjects." }));

describe(listTaskSubjectInputs, () => {
  it("asks about each written task with the reading's subjects, parts and choices, never the written test itself", () => {
    expect(listTaskSubjectInputs(reading())).toStrictEqual({
      names: [
        "Ética",
        "Conhecimentos gerais",
        "Auditoria",
        "Conhecimentos específicos",
        "Área",
        "Sistemas",
      ],
      tasks: [
        { description: TASK, id: "2.1", section: "Prova discursiva" },
        { description: CASE, id: "2.2", section: "Prova discursiva" },
      ],
    });
  });
});

describe(applyWrittenTaskSubjects, () => {
  it("gives a task the subjects found for it with the passage that says so, and leaves the others as read", () => {
    const extraction = reading();

    const applied = applyWrittenTaskSubjects({
      extraction,
      found: [{ document: 1, passage: TIE, subjects: ["Conhecimentos gerais"], task: "2.1" }],
    });

    const [question, studyCase] = applied.mock?.sections[1]?.tasks ?? [];

    expect(question).toMatchObject({
      passages: [
        { document: 1, passage: TASK },
        { document: 1, passage: TIE },
      ],
      subjects: ["Conhecimentos gerais"],
    });

    expect(studyCase).toBe(extraction.mock?.sections[1]?.tasks[1]);
  });
});
