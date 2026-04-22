import { describe, expect, test } from "vitest";
import { stepImageSchema } from "./image";

describe("step image contract", () => {
  test("parses a prompt-only image payload", () => {
    const image = stepImageSchema.parse({
      prompt: "A clean diagram of a neural network",
    });

    expect(image).toEqual({
      prompt: "A clean diagram of a neural network",
    });
  });

  test("parses an uploaded image payload", () => {
    const image = stepImageSchema.parse({
      prompt: "A clean diagram of a neural network",
      url: "https://example.com/neural-network.webp",
    });

    expect(image).toEqual({
      prompt: "A clean diagram of a neural network",
      url: "https://example.com/neural-network.webp",
    });
  });

  test("rejects missing prompts", () => {
    expect(() =>
      stepImageSchema.parse({
        url: "https://example.com/neural-network.webp",
      }),
    ).toThrow();
  });
});
