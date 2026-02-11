import { describe, expect, test } from "vitest";
import { isSupportedVisualKind, parseVisualContent } from "./visual-content-contract";

describe("visual content contracts", () => {
  test("parses code visual content", () => {
    const content = parseVisualContent("code", {
      code: "console.log('hello')",
      language: "javascript",
    });

    expect(content).toEqual({
      code: "console.log('hello')",
      language: "javascript",
    });
  });

  test("parses code visual content with annotations", () => {
    const content = parseVisualContent("code", {
      annotations: [{ line: 1, text: "Variable declaration" }],
      code: "const x = 1;",
      language: "typescript",
    });

    expect(content).toEqual({
      annotations: [{ line: 1, text: "Variable declaration" }],
      code: "const x = 1;",
      language: "typescript",
    });
  });

  test("parses chart visual content", () => {
    const content = parseVisualContent("chart", {
      chartType: "bar",
      data: [{ name: "Q1", value: 100 }],
      title: "Sales",
    });

    expect(content).toEqual({
      chartType: "bar",
      data: [{ name: "Q1", value: 100 }],
      title: "Sales",
    });
  });

  test("parses diagram visual content", () => {
    const content = parseVisualContent("diagram", {
      edges: [{ source: "a", target: "b" }],
      nodes: [{ id: "a", label: "Start" }],
    });

    expect(content).toEqual({
      edges: [{ source: "a", target: "b" }],
      nodes: [{ id: "a", label: "Start" }],
    });
  });

  test("parses diagram with edge labels", () => {
    const content = parseVisualContent("diagram", {
      edges: [{ label: "next", source: "a", target: "b" }],
      nodes: [
        { id: "a", label: "Start" },
        { id: "b", label: "End" },
      ],
    });

    expect(content).toEqual({
      edges: [{ label: "next", source: "a", target: "b" }],
      nodes: [
        { id: "a", label: "Start" },
        { id: "b", label: "End" },
      ],
    });
  });

  test("parses image visual content without url", () => {
    const content = parseVisualContent("image", {
      prompt: "A cat sitting on a mat",
    });

    expect(content).toEqual({
      prompt: "A cat sitting on a mat",
    });
  });

  test("parses image visual content with url", () => {
    const content = parseVisualContent("image", {
      prompt: "A cat sitting on a mat",
      url: "https://example.com/cat.png",
    });

    expect(content).toEqual({
      prompt: "A cat sitting on a mat",
      url: "https://example.com/cat.png",
    });
  });

  test("parses quote visual content", () => {
    const content = parseVisualContent("quote", {
      author: "Shakespeare",
      text: "To be or not to be",
    });

    expect(content).toEqual({
      author: "Shakespeare",
      text: "To be or not to be",
    });
  });

  test("parses table visual content", () => {
    const content = parseVisualContent("table", {
      columns: ["Name", "Age"],
      rows: [["Alice", "30"]],
    });

    expect(content).toEqual({
      columns: ["Name", "Age"],
      rows: [["Alice", "30"]],
    });
  });

  test("parses table visual content with caption", () => {
    const content = parseVisualContent("table", {
      caption: "User data",
      columns: ["Name", "Age"],
      rows: [["Alice", "30"]],
    });

    expect(content).toEqual({
      caption: "User data",
      columns: ["Name", "Age"],
      rows: [["Alice", "30"]],
    });
  });

  test("parses timeline visual content", () => {
    const content = parseVisualContent("timeline", {
      events: [{ date: "2020-01-01", description: "Company founded", title: "Founded" }],
    });

    expect(content).toEqual({
      events: [{ date: "2020-01-01", description: "Company founded", title: "Founded" }],
    });
  });

  test("rejects extra fields (strict mode)", () => {
    expect(() =>
      parseVisualContent("code", {
        code: "x",
        extraField: "not allowed",
        language: "js",
      }),
    ).toThrow();
  });

  test("rejects missing required fields", () => {
    expect(() => parseVisualContent("code", { code: "x" })).toThrow();
    expect(() => parseVisualContent("chart", { chartType: "bar" })).toThrow();
    expect(() => parseVisualContent("quote", { text: "hi" })).toThrow();
  });

  test("isSupportedVisualKind returns true for supported kinds", () => {
    expect(isSupportedVisualKind("code")).toBeTruthy();
    expect(isSupportedVisualKind("chart")).toBeTruthy();
    expect(isSupportedVisualKind("diagram")).toBeTruthy();
    expect(isSupportedVisualKind("image")).toBeTruthy();
    expect(isSupportedVisualKind("quote")).toBeTruthy();
    expect(isSupportedVisualKind("table")).toBeTruthy();
    expect(isSupportedVisualKind("timeline")).toBeTruthy();
  });

  test("isSupportedVisualKind returns false for unsupported kinds", () => {
    expect(isSupportedVisualKind("audio")).toBeFalsy();
    expect(isSupportedVisualKind("video")).toBeFalsy();
  });
});
