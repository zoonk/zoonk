import { describe, expect, test, vi } from "vitest";
import { dispatchVisualContent } from "./dispatch-visual-content";

vi.mock("@zoonk/ai/tasks/visuals/chart", () => ({
  generateVisualChart: vi.fn().mockResolvedValue({
    data: { chartType: "bar", data: [{ name: "A", value: 10 }], title: "Test Chart" },
  }),
}));

vi.mock("@zoonk/ai/tasks/visuals/code", () => ({
  generateVisualCode: vi.fn().mockResolvedValue({
    data: { annotations: null, code: "const x = 1;", language: "typescript" },
  }),
}));

vi.mock("@zoonk/ai/tasks/visuals/diagram", () => ({
  generateVisualDiagram: vi.fn().mockResolvedValue({
    data: { edges: [], nodes: [{ id: "1", label: "Node" }] },
  }),
}));

vi.mock("@zoonk/ai/tasks/visuals/formula", () => ({
  generateVisualFormula: vi.fn().mockResolvedValue({
    data: { description: "Test formula", formula: "E = mc^2" },
  }),
}));

vi.mock("@zoonk/ai/tasks/visuals/music", () => ({
  generateVisualMusic: vi.fn().mockResolvedValue({
    data: { abc: "X:1\nK:C\nCDEF", description: "C major scale" },
  }),
}));

vi.mock("@zoonk/ai/tasks/visuals/quote", () => ({
  generateVisualQuote: vi.fn().mockResolvedValue({
    data: { author: "Einstein", canVerify: true, text: "Imagination is everything." },
  }),
}));

vi.mock("@zoonk/ai/tasks/visuals/table", () => ({
  generateVisualTable: vi.fn().mockResolvedValue({
    data: { caption: null, columns: ["A", "B"], rows: [["1", "2"]] },
  }),
}));

vi.mock("@zoonk/ai/tasks/visuals/timeline", () => ({
  generateVisualTimeline: vi.fn().mockResolvedValue({
    data: { events: [{ date: "1789", description: "Revolution", title: "Bastille" }] },
  }),
}));

vi.mock("@zoonk/core/steps/visual-image", () => ({
  generateVisualStepImage: vi.fn().mockResolvedValue({
    data: "https://example.com/image.webp",
    error: null,
  }),
}));

describe(dispatchVisualContent, () => {
  test("dispatches chart description to chart generator", async () => {
    const results = await dispatchVisualContent({
      descriptions: [{ description: "A bar chart", kind: "chart" }],
      language: "en",
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      chartType: "bar",
      data: [{ name: "A", value: 10 }],
      kind: "chart",
      title: "Test Chart",
    });
  });

  test("dispatches code description to code generator", async () => {
    const results = await dispatchVisualContent({
      descriptions: [{ description: "A code snippet", kind: "code" }],
      language: "en",
    });

    expect(results[0]).toMatchObject({ code: "const x = 1;", kind: "code" });
  });

  test("dispatches image description to image generator with URL", async () => {
    const results = await dispatchVisualContent({
      descriptions: [{ description: "A visual of a concept", kind: "image" }],
      language: "en",
      orgSlug: "test-org",
    });

    expect(results[0]).toEqual({
      kind: "image",
      prompt: "A visual of a concept",
      url: "https://example.com/image.webp",
    });
  });

  test("throws when image generation returns an error", async () => {
    const { generateVisualStepImage } = await import("@zoonk/core/steps/visual-image");

    vi.mocked(generateVisualStepImage).mockResolvedValueOnce({
      data: null,
      error: new Error("Image generation failed"),
    });

    await expect(
      dispatchVisualContent({
        descriptions: [{ description: "A broken image", kind: "image" }],
        language: "en",
      }),
    ).rejects.toThrow("Image generation failed");
  });

  test("returns results in same order as input descriptions", async () => {
    const results = await dispatchVisualContent({
      descriptions: [
        { description: "A table", kind: "table" },
        { description: "An image", kind: "image" },
        { description: "A timeline", kind: "timeline" },
      ],
      language: "en",
    });

    expect(results).toHaveLength(3);
    expect(results[0]?.kind).toBe("table");
    expect(results[1]?.kind).toBe("image");
    expect(results[2]?.kind).toBe("timeline");
  });

  test("falls back to image when a dispatch throws", async () => {
    const { generateVisualChart } = await import("@zoonk/ai/tasks/visuals/chart");
    vi.mocked(generateVisualChart).mockRejectedValueOnce(new Error("Chart generation failed"));

    const results = await dispatchVisualContent({
      descriptions: [{ description: "A failing chart", kind: "chart" }],
      language: "en",
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      kind: "image",
      prompt: "A failing chart",
    });
  });

  test("handles all failures gracefully with fallbacks", async () => {
    const { generateVisualCode } = await import("@zoonk/ai/tasks/visuals/code");
    const { generateVisualDiagram } = await import("@zoonk/ai/tasks/visuals/diagram");

    vi.mocked(generateVisualCode).mockRejectedValueOnce(new Error("Code failed"));
    vi.mocked(generateVisualDiagram).mockRejectedValueOnce(new Error("Diagram failed"));

    const results = await dispatchVisualContent({
      descriptions: [
        { description: "Failing code", kind: "code" },
        { description: "Failing diagram", kind: "diagram" },
      ],
      language: "en",
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ kind: "image", prompt: "Failing code" });
    expect(results[1]).toEqual({ kind: "image", prompt: "Failing diagram" });
  });

  test("dispatches all structured kinds correctly", async () => {
    const kinds = [
      "chart",
      "code",
      "diagram",
      "formula",
      "music",
      "quote",
      "table",
      "timeline",
    ] as const;

    const results = await dispatchVisualContent({
      descriptions: kinds.map((kind) => ({ description: `A ${kind} visual`, kind })),
      language: "en",
    });

    expect(results).toHaveLength(8);

    for (let index = 0; index < kinds.length; index += 1) {
      expect(results[index]?.kind).toBe(kinds[index]);
    }
  });
});
