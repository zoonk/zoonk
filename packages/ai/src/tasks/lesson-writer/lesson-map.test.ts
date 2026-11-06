import { describe, expect, it } from "vitest";
import { normalizeLessonMap } from "./lesson-map";

const idea = (label: string, text: string) => ({ label, text });

describe(normalizeLessonMap, () => {
  it("keeps a nested map with plain labels and trimmed sentences", () => {
    const map = normalizeLessonMap({
      ideas: [
        idea("**Organismo**", " Um ser vivo. "),
        idea("População.", "Uma espécie num lugar."),
        idea("Comunidade", "Todas as populações de um lugar."),
      ],
      shape: "nested",
    });

    expect(map).toStrictEqual({
      ideas: [
        idea("Organismo", "Um ser vivo."),
        idea("População", "Uma espécie num lugar."),
        idea("Comunidade", "Todas as populações de um lugar."),
      ],
      shape: "nested",
    });
  });

  it("keeps every idea, long labels and more than five included", () => {
    const six = ["A.", "B.", "C.", "D.", "E.", "Result."].map((text, index) =>
      idea(`Ein ziemlich langer Name ${index}`, text),
    );

    expect(normalizeLessonMap({ ideas: six, shape: "hub" }).ideas).toStrictEqual(six);
  });

  it("drops empty ideas and exact repeats, but keeps a sentence two labels share", () => {
    const map = normalizeLessonMap({
      ideas: [
        idea("Empty", " "),
        idea("Sólido", "Tem volume fixo."),
        idea("Sólido ", "Tem  volume fixo."),
        idea("Líquido", "Tem volume fixo."),
      ],
      shape: "hub",
    });

    expect(map.ideas).toStrictEqual([
      idea("Sólido", "Tem volume fixo."),
      idea("Líquido", "Tem volume fixo."),
    ]);
  });

  it("keeps ideas that differ only in accents or case", () => {
    const ideas = [
      idea("Avó", "Avó é uma palavra de duas sílabas."),
      idea("Avô", "Avô é uma palavra de duas sílabas."),
      idea("avô", "avô é uma palavra de duas sílabas."),
    ];

    expect(normalizeLessonMap({ ideas, shape: "hub" }).ideas).toStrictEqual(ideas);
  });

  it("draws more than five nested levels as a hub, keeping every idea", () => {
    const six = ["Átomo", "Molécula", "Célula", "Tecido", "Órgão", "Organismo"].map((label) =>
      idea(label, `${label} é um nível.`),
    );

    expect(normalizeLessonMap({ ideas: six, shape: "nested" })).toStrictEqual({
      ideas: six,
      shape: "hub",
    });

    expect(normalizeLessonMap({ ideas: six.slice(0, 5), shape: "nested" }).shape).toBe("nested");
  });

  it("leaves out a label that is only marks", () => {
    expect(normalizeLessonMap({ ideas: [idea("**", "Uma ideia.")], shape: "hub" })).toStrictEqual({
      ideas: [{ text: "Uma ideia." }],
      shape: "hub",
    });
  });

  it("draws a nested map as a hub when a level has no name or there is only one", () => {
    const named = [idea("Organismo", "Um ser vivo."), idea("População", "Uma espécie.")];
    const unnamed = [idea("Organismo", "Um ser vivo."), idea("**", "Uma espécie.")];

    expect(normalizeLessonMap({ ideas: named, shape: "nested" }).shape).toBe("nested");
    expect(normalizeLessonMap({ ideas: unnamed, shape: "nested" }).shape).toBe("hub");
    expect(normalizeLessonMap({ ideas: named.slice(0, 1), shape: "nested" }).shape).toBe("hub");
  });
});
