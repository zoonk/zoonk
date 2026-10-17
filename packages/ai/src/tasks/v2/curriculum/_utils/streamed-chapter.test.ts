import { describe, expect, it } from "vitest";
import { readStreamedChapter } from "./streamed-chapter";

const rawOutline = {
  chapters: [
    {
      description: " How antibodies find germs ",
      lessons: [
        {
          canDo: "Explain what an antibody binds to",
          description: "Antibodies stick to one shape on a germ.",
          estimatedMinutes: 40,
          skills: ["Explain antibody binding", "explain antibody binding"],
          title: " Antibodies and antigens ",
        },
      ],
      objectives: ["Explain antibody binding"],
      skillKeys: ["not-required"],
      title: "Antibodies",
      tools: [],
    },
    {
      description: "Empty",
      lessons: [],
      objectives: [],
      skillKeys: [],
      title: "Nothing",
      tools: [],
    },
  ],
};

function readEarly(chapters: unknown[]) {
  return readStreamedChapter({
    chapters,
    isWanted: (chapter) => chapter.skillKeys.includes("antibodies"),
    level: "beginner",
    requiredSkillKeys: ["antibodies"],
  });
}

describe(readStreamedChapter, () => {
  const [antibodies, empty] = rawOutline.chapters;
  const wanted = { ...antibodies, skillKeys: ["antibodies", "other"] };
  const next = { title: "Vacc" };

  it("waits until the model starts the next chapter, then cleans the wanted one like the whole outline", () => {
    expect(readEarly([])).toBeNull();
    expect(readEarly([wanted])).toBeNull();

    expect(readEarly([wanted, next])).toMatchObject({
      before: [],
      chapter: { description: "How antibodies find germs", skillKeys: ["antibodies"] },
    });
  });

  it("gives the finished chapters before the wanted one, leaving out those the cleaning drops", () => {
    const found = readEarly([empty, antibodies, wanted, next]);

    expect(found?.before.map((chapter) => chapter.title)).toStrictEqual(["Antibodies"]);
    expect(found?.chapter.skillKeys).toStrictEqual(["antibodies"]);
    expect(readEarly([empty, antibodies, next])).toBeNull();
  });
});
