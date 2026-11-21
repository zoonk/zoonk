import { describe, expect, it } from "vitest";
import { NOTICE, blueprintExtraction } from "./_test-utils/blueprint-extraction";
import { toBlueprintContent } from "./blueprint-content";
import { type ExamStructure } from "./blueprint-contract";
import { listBlueprintFacts } from "./blueprint-facts";
import { listWrittenTasks, withWrittenTaskKeys } from "./written-tasks";

const TASK_PASSAGE = "Part A has 2 handwritten answers, each up to 30 lines and worth 30.5 points.";
const CRITERION_PASSAGE = "Clear reasoning earns 30.5 points.";
const RULE_PASSAGE = "Subtract 2 points per language error divided by the number of written lines.";
const SESSION_PASSAGE = "The Written test starts in the afternoon and lasts 210 minutes.";

const DOCUMENTS = [
  {
    sourceId: "notice",
    text: [TASK_PASSAGE, CRITERION_PASSAGE, RULE_PASSAGE, SESSION_PASSAGE].join("\n"),
  },
];

const SUBJECTS_PASSAGE = "Part A is on Linguagens and Física.";

function readWrittenTest({
  documents = DOCUMENTS,
  subjects,
}: { documents?: typeof DOCUMENTS; subjects?: string[] } = {}) {
  const base = blueprintExtraction();

  const extraction = {
    ...base,
    mock: base.mock && {
      ...base.mock,
      passages: [],
      sections: [
        {
          breakAfterMinutes: null,
          day: null,
          kind: "written" as const,
          minutes: 210,
          name: "Written test",
          navigation: null,
          passages: [{ document: 1, passage: SESSION_PASSAGE }],
          questions: null,
          session: "afternoon",
          tasks: [
            {
              count: 2,
              description: "Part A",
              grading: {
                criteria: [
                  {
                    document: 1,
                    id: "reasoning",
                    passage: CRITERION_PASSAGE,
                    points: 30.5,
                    text: "Clear reasoning",
                  },
                ],
                kind: "points" as const,
                language: {
                  document: 1,
                  factor: 2,
                  formula: "2 × errors ÷ lines",
                  method: "errorsPerLine" as const,
                  passage: RULE_PASSAGE,
                  text: "Deduct for language errors",
                },
                rounding: {
                  document: 1,
                  passage: "Round to two decimals.",
                  text: "Round to two decimals",
                },
                zeroing: [],
              },
              handwritten: true,
              lines: 30,
              officialIdentifier: "Part A",
              passages: [
                { document: 1, passage: TASK_PASSAGE },
                ...(subjects ? [{ document: 1, passage: SUBJECTS_PASSAGE }] : []),
              ],
              plays: null,
              points: 30.5,
              ...(subjects && { subjects }),
            },
          ],
          tools: null,
        },
      ],
    },
  };

  const facts = listBlueprintFacts({ documents, extraction });

  return toBlueprintContent({
    documents,
    extraction,
    facts,
    noticeUrl: "https://example.com/notice",
    sourceHash: "notice",
    supportedIds: facts.map(({ id }) => id),
  }).structure;
}

describe(listWrittenTasks, () => {
  it("keeps the section session, clock, decimal marks and verified passages", () => {
    const structure = readWrittenTest();
    const [task] = listWrittenTasks({ structure });

    expect(task).toMatchObject({
      count: 2,
      grading: {
        criteria: [{ citation: { passage: CRITERION_PASSAGE, sourceId: "notice" }, points: 30.5 }],
        kind: "levels",
        language: {
          citation: { passage: RULE_PASSAGE, sourceId: "notice" },
          formula: "2 × errors ÷ lines",
        },
        rounding: null,
      },
      handwritten: true,
      lines: 30,
      minutes: 210,
      points: 30.5,
      session: "afternoon",
    });
  });

  it("links a task only to the subjects of the same reading that the notice names for it", () => {
    const documents = [
      { sourceId: "notice", text: [NOTICE, DOCUMENTS[0]?.text, SUBJECTS_PASSAGE].join("\n") },
    ];

    const [linked] = listWrittenTasks({
      structure: readWrittenTest({ documents, subjects: ["linguagens", "Física"] }),
    });

    const [unstated] = listWrittenTasks({
      structure: readWrittenTest({ documents, subjects: [] }),
    });

    expect(linked?.subjects).toStrictEqual(["Linguagens"]);
    expect(unstated?.subjects).toBeNull();
  });

  it("keeps an official key through changed labels and marks and issues a new key for a different task", () => {
    const old = withWrittenTaskKeys({ current: null, next: readWrittenTest() });
    const section = old.mock!.sections[0]!;
    const task = section.tasks![0]!;

    const change = (officialIdentifier: string): ExamStructure => ({
      ...old,
      mock: {
        ...old.mock!,
        sections: [
          {
            ...section,
            name: "Teste escrito",
            tasks: [{ ...task, description: "Parte A", officialIdentifier, points: 31.5 }],
          },
        ],
      },
    });

    const [prior] = listWrittenTasks({ structure: old });

    const [reread] = listWrittenTasks({
      structure: withWrittenTaskKeys({ current: old, next: change("Part A") }),
    });

    const [different] = listWrittenTasks({
      structure: withWrittenTaskKeys({ current: old, next: change("Part B") }),
    });

    expect(prior?.key).toBe(reread?.key);
    expect(different?.key).not.toBe(prior?.key);
    expect(reread?.points).toBe(31.5);
  });

  it("preserves a uniquely matched unnamed task through rewording", () => {
    const original = readWrittenTest();
    const section = original.mock!.sections[0]!;
    const task = { ...section.tasks![0]!, officialIdentifier: undefined };

    const change = (tasks: typeof section.tasks): ExamStructure => ({
      ...original,
      mock: { ...original.mock!, sections: [{ ...section, tasks }] },
    });

    const current = withWrittenTaskKeys({ current: null, next: change([task]) });
    const [prior] = listWrittenTasks({ structure: current });
    const reread = { ...task, description: "Write both long answers" };

    const keys = (tasks: typeof section.tasks) =>
      listWrittenTasks({ structure: withWrittenTaskKeys({ current, next: change(tasks) }) }).map(
        ({ key }) => key,
      );

    expect(keys([reread])).toStrictEqual([prior?.key]);
    expect(keys([{ ...task, lines: 40 }])).not.toContain(prior?.key);
    expect(keys([{ ...task, points: 40 }])).not.toContain(prior?.key);
    expect(keys([task, { ...reread, lines: 40 }])[0]).toBe(prior?.key);
    expect(keys([{ ...reread, lines: 40 }])).not.toContain(prior?.key);
  });

  it("uses practice pacing for a writing task named in a mixed sitting", () => {
    const old = readWrittenTest();
    const written = old.mock!.sections[0]!;

    const structure = {
      ...old,
      mock: {
        ...old.mock!,
        sections: [
          { ...written, day: 1, kind: "objective" as const, minutes: 330, tasks: [] },
          { ...written, day: 1, minutes: 330 },
        ],
      },
    };

    expect(listWrittenTasks({ day: 2, structure })).toStrictEqual([]);
    expect(listWrittenTasks({ day: 1, structure })).toMatchObject([{ minutes: null }]);
  });
});
