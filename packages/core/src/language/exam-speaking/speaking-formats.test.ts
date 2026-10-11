import { describe, expect, it } from "vitest";
import { getSpeakingFormat, listTaskCriteria } from "./speaking-formats";

function criteriaOf(task: string) {
  const format = getSpeakingFormat({ exam: "cambridge", level: "B2" });

  if (!format) {
    throw new Error("No B2 First paper");
  }

  return listTaskCriteria({ format, task }).map((criterion) => criterion.key);
}

describe(listTaskCriteria, () => {
  it("rates B2 First's long turn without Interactive Communication, which a monologue can't show", () => {
    expect(criteriaOf("p2")).toStrictEqual([
      "grammarVocabulary",
      "discourse",
      "pronunciation",
      "global",
    ]);
  });

  it("rates the collaborative task on every scale of the paper", () => {
    expect(criteriaOf("p3")).toStrictEqual([
      "grammarVocabulary",
      "discourse",
      "pronunciation",
      "interaction",
      "global",
    ]);
  });
});
