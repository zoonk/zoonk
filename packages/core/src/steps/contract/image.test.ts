import { describe, expect, it } from "vitest";
import { stepImageSchema } from "./image";

describe("step image contract", () => {
  it("parses a prompt-only image payload", () => {
    const image = stepImageSchema.parse({ prompt: "A clean diagram of a neural network" });

    expect(image).toEqual({ prompt: "A clean diagram of a neural network" });
  });

  it("parses an uploaded image payload", () => {
    const image = stepImageSchema.parse({
      prompt: "A clean diagram of a neural network",
      url: "https://example.com/neural-network.webp",
    });

    expect(image).toEqual({
      prompt: "A clean diagram of a neural network",
      url: "https://example.com/neural-network.webp",
    });
  });

  it("rejects missing prompts", () => {
    expect(() =>
      stepImageSchema.parse({ url: "https://example.com/neural-network.webp" }),
    ).toThrow();
  });
});
