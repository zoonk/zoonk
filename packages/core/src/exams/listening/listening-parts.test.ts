import { describe, expect, it } from "vitest";
import { listListeningParts } from "./listening-parts";

function section(attrs: {
  kind: "listening" | "objective";
  name: string;
  questions: number | null;
  tasks?: { count: number; description: string; plays?: number | null }[];
}) {
  return { day: null, minutes: 30, ...attrs };
}

function mock(sections: ReturnType<typeof section>[]) {
  return {
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "", method: "other" as const },
      sections,
      timeLimitMinutes: null,
      totalQuestions: null,
    },
  };
}

describe(listListeningParts, () => {
  it("lists each recording the notice describes, in order, with how many times it's played", () => {
    const parts = listListeningParts(
      mock([
        section({ kind: "objective", name: "Reading", questions: 40 }),
        section({
          kind: "listening",
          name: "Listening",
          questions: 40,
          tasks: [
            { count: 10, description: "Part 1: a conversation; form completion", plays: 1 },
            { count: 10, description: "Part 2: a monologue; multiple choice", plays: null },
            { count: 20, description: "Part 3: a discussion" },
          ],
        }),
      ]),
    );

    expect(parts).toStrictEqual([
      {
        count: 10,
        plays: 1,
        sectionName: "Listening",
        task: "Part 1: a conversation; form completion",
      },
      {
        count: 10,
        plays: 2,
        sectionName: "Listening",
        task: "Part 2: a monologue; multiple choice",
      },
      { count: 10, plays: 2, sectionName: "Listening", task: "Part 3: a discussion" },
    ]);
  });

  it("asks one recording per listening section whose parts the notice doesn't list", () => {
    const parts = listListeningParts(
      mock([
        section({ kind: "listening", name: "Hörverstehen", questions: 8 }),
        section({ kind: "listening", name: "Comprensión auditiva", questions: null }),
      ]),
    );

    expect(parts).toStrictEqual([
      { count: 8, plays: 2, sectionName: "Hörverstehen", task: "Hörverstehen" },
      { count: 6, plays: 2, sectionName: "Comprensión auditiva", task: "Comprensión auditiva" },
    ]);
  });

  it("names a part by its section and number when its description wasn't kept", () => {
    const parts = listListeningParts(
      mock([
        section({
          kind: "listening",
          name: "Listening",
          questions: 20,
          tasks: [
            { count: 10, description: "", plays: 1 },
            { count: 10, description: "Part 2: a monologue", plays: 1 },
          ],
        }),
      ]),
    );

    expect(parts.map((part) => part.task)).toStrictEqual([
      "Listening, part 1 of 2",
      "Part 2: a monologue",
    ]);
  });

  it("has nothing to play for an exam without listening", () => {
    expect(listListeningParts({ mock: null })).toStrictEqual([]);

    expect(
      listListeningParts(mock([section({ kind: "objective", name: "Math", questions: 45 })])),
    ).toStrictEqual([]);
  });
});
