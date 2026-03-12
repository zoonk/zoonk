import { describe, expect, test } from "vitest";
import { visualStepContentSchema } from "./visual-content-contract";

describe("visual content contracts", () => {
  test("parses code visual content", () => {
    const content = visualStepContentSchema.parse({
      code: "console.log('hello')",
      kind: "code",
      language: "javascript",
    });

    expect(content).toEqual({
      code: "console.log('hello')",
      kind: "code",
      language: "javascript",
    });
  });

  test("parses code visual content with annotations", () => {
    const content = visualStepContentSchema.parse({
      annotations: [{ line: 1, text: "Variable declaration" }],
      code: "const x = 1;",
      kind: "code",
      language: "typescript",
    });

    expect(content).toEqual({
      annotations: [{ line: 1, text: "Variable declaration" }],
      code: "const x = 1;",
      kind: "code",
      language: "typescript",
    });
  });

  test("parses chart visual content", () => {
    const content = visualStepContentSchema.parse({
      chartType: "bar",
      data: [{ name: "Q1", value: 100 }],
      kind: "chart",
      title: "Sales",
    });

    expect(content).toEqual({
      chartType: "bar",
      data: [{ name: "Q1", value: 100 }],
      kind: "chart",
      title: "Sales",
    });
  });

  test("parses diagram visual content", () => {
    const content = visualStepContentSchema.parse({
      edges: [{ source: "a", target: "b" }],
      kind: "diagram",
      nodes: [{ id: "a", label: "Start" }],
    });

    expect(content).toEqual({
      edges: [{ source: "a", target: "b" }],
      kind: "diagram",
      nodes: [{ id: "a", label: "Start" }],
    });
  });

  test("parses diagram with edge labels", () => {
    const content = visualStepContentSchema.parse({
      edges: [{ label: "next", source: "a", target: "b" }],
      kind: "diagram",
      nodes: [
        { id: "a", label: "Start" },
        { id: "b", label: "End" },
      ],
    });

    expect(content).toEqual({
      edges: [{ label: "next", source: "a", target: "b" }],
      kind: "diagram",
      nodes: [
        { id: "a", label: "Start" },
        { id: "b", label: "End" },
      ],
    });
  });

  test("parses image visual content without url", () => {
    const content = visualStepContentSchema.parse({
      kind: "image",
      prompt: "A cat sitting on a mat",
    });

    expect(content).toEqual({
      kind: "image",
      prompt: "A cat sitting on a mat",
    });
  });

  test("parses image visual content with url", () => {
    const content = visualStepContentSchema.parse({
      kind: "image",
      prompt: "A cat sitting on a mat",
      url: "https://example.com/cat.png",
    });

    expect(content).toEqual({
      kind: "image",
      prompt: "A cat sitting on a mat",
      url: "https://example.com/cat.png",
    });
  });

  test("parses quote visual content", () => {
    const content = visualStepContentSchema.parse({
      author: "Shakespeare",
      kind: "quote",
      text: "To be or not to be",
    });

    expect(content).toEqual({
      author: "Shakespeare",
      kind: "quote",
      text: "To be or not to be",
    });
  });

  test("parses table visual content", () => {
    const content = visualStepContentSchema.parse({
      columns: ["Name", "Age"],
      kind: "table",
      rows: [["Alice", "30"]],
    });

    expect(content).toEqual({
      columns: ["Name", "Age"],
      kind: "table",
      rows: [["Alice", "30"]],
    });
  });

  test("parses table visual content with caption", () => {
    const content = visualStepContentSchema.parse({
      caption: "User data",
      columns: ["Name", "Age"],
      kind: "table",
      rows: [["Alice", "30"]],
    });

    expect(content).toEqual({
      caption: "User data",
      columns: ["Name", "Age"],
      kind: "table",
      rows: [["Alice", "30"]],
    });
  });

  test("parses timeline visual content", () => {
    const content = visualStepContentSchema.parse({
      events: [{ date: "2020-01-01", description: "Company founded", title: "Founded" }],
      kind: "timeline",
    });

    expect(content).toEqual({
      events: [{ date: "2020-01-01", description: "Company founded", title: "Founded" }],
      kind: "timeline",
    });
  });

  test("rejects missing kind discriminant", () => {
    expect(() =>
      visualStepContentSchema.parse({
        code: "x",
        language: "js",
      }),
    ).toThrow();
  });

  test("rejects invalid kind discriminant", () => {
    expect(() =>
      visualStepContentSchema.parse({
        code: "x",
        kind: "unknown",
        language: "js",
      }),
    ).toThrow();
  });

  test("rejects missing required fields", () => {
    expect(() => visualStepContentSchema.parse({ code: "x", kind: "code" })).toThrow();
    expect(() => visualStepContentSchema.parse({ chartType: "bar", kind: "chart" })).toThrow();
    expect(() => visualStepContentSchema.parse({ kind: "quote", text: "hi" })).toThrow();
  });
});
