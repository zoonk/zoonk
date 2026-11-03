import { describe, expect, it } from "vitest";
import { getLessonMapIdeas, normalizeLessonMap } from "./lesson-map";

const node = (label: string, idea: string) => ({ idea, label });

describe(normalizeLessonMap, () => {
  it("keeps a map whose nodes fit its shape, with plain labels and trimmed ideas", () => {
    const map = normalizeLessonMap({
      nodes: [
        node("**Organismo**", " Um ser vivo. "),
        node("População.", "Uma espécie num lugar."),
        node("Comunidade", "Todas as populações de um lugar."),
      ],
      shape: "nested",
    });

    expect(map).toStrictEqual({
      nodes: [
        node("Organismo", "Um ser vivo."),
        node("População", "Uma espécie num lugar."),
        node("Comunidade", "Todas as populações de um lugar."),
      ],
      shape: "nested",
    });
  });

  it("drops empty and repeated ideas and keeps the first five", () => {
    const ideas = ["A.", "B.", "C.", "D.", "E.", "F."];

    const map = normalizeLessonMap({
      nodes: [node("Empty", " "), node("A again", "a."), ...ideas.map((idea) => node(idea, idea))],
      shape: "sequence",
    });

    expect(getLessonMapIdeas(map)).toStrictEqual(["a.", "B.", "C.", "D.", "E."]);
  });

  it("draws a map as a list when its nodes don't fit its shape", () => {
    const owes = node("Dívidas", "O que ela deve.");
    const twoNodes = [node("Bens", "O que a empresa tem."), owes];
    const longLabel = [node("Tudo o que a empresa tem hoje", "O que a empresa tem."), owes];
    const four = ["A.", "B.", "C.", "D."].map((idea) => node(idea, idea));

    expect(normalizeLessonMap({ nodes: twoNodes, shape: "equation" }).shape).toBe("list");
    expect(normalizeLessonMap({ nodes: twoNodes, shape: "hub" }).shape).toBe("list");
    expect(normalizeLessonMap({ nodes: four, shape: "compare" }).shape).toBe("list");
    expect(normalizeLessonMap({ nodes: longLabel, shape: "compare" }).shape).toBe("list");
    expect(normalizeLessonMap({ nodes: twoNodes, shape: "compare" }).shape).toBe("compare");
  });

  it("draws a map with more than five ideas as a list, so no step or result is cut from its shape", () => {
    const six = ["A.", "B.", "C.", "D.", "E.", "Result."].map((idea) => node(idea, idea));
    const map = normalizeLessonMap({ nodes: six, shape: "equation" });

    expect(map.shape).toBe("list");
    expect(map.nodes).toHaveLength(5);
  });
});
