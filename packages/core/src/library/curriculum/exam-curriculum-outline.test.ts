import { formatExamOutline } from "@zoonk/ai/tasks/curriculum/exam-outline";
import { describe, expect, it } from "vitest";
import { getWrittenTasks } from "../../exams/_utils/written-tasks";
import { type ExamStructure } from "../exams/blueprint-contract";
import { toExamOutline } from "./exam-curriculum-outline";

const citation = { passage: "Choose one language for writing.", sourceId: "notice" };

function option(name: string) {
  return {
    choiceGroup: "Language",
    citation,
    group: "Writing",
    name,
    questions: null,
    topics: [],
    weight: null,
  };
}

describe(toExamOutline, () => {
  it("uses each task's own subjects before falling back to its section", () => {
    const french = option("French");
    const spanish = option("Spanish");

    const structure: ExamStructure = {
      formats: [],
      mock: {
        adaptive: false,
        citations: [],
        order: null,
        scoring: { description: "", method: "raw" },
        sections: [
          {
            day: null,
            kind: "written",
            minutes: null,
            name: "Writing",
            questions: null,
            tasks: [
              { count: 1, description: "Write a letter", subjects: [french.name] },
              { count: 1, description: "Write an argument" },
            ],
          },
        ],
        timeLimitMinutes: null,
        totalQuestions: null,
      },
      rules: [],
      subjects: [french, spanish],
    };

    expect(getWrittenTasks({ structure, subject: french })).toStrictEqual([
      "Write a letter",
      "Write an argument",
    ]);

    expect(getWrittenTasks({ structure, subject: spanish })).toStrictEqual(["Write an argument"]);

    const outline = toExamOutline({ name: "Language exam", structure, topicFrequency: [] });
    const formatted = formatExamOutline(outline);
    expect(formatted).toContain("Writing | Write a letter | Subjects: French\n");
    expect(formatted).toContain("Writing | Write an argument | Subjects: French / Spanish");
  });
});
