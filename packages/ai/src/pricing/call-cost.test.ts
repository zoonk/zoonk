import { describe, expect, it } from "vitest";
import { GATEWAY_PRICES, computeCallCostUsd } from "./call-cost";

const MILLION = 1_000_000;
/** A speech clip costs a fraction of a cent, so its prices are compared to a millionth of a cent. */
const CENT_FRACTION_DIGITS = 8;

describe(computeCallCostUsd, () => {
  it("prices uncached input, cached reads, cache writes and output at their own rates", () => {
    // Sol: $2 input, $0.20 cached read, $2.50 cache write and $10 output per million tokens.
    const cost = computeCallCostUsd({
      model: "openai/gpt-6-sol",
      usage: {
        cacheReadTokens: 40_000,
        cacheWriteTokens: 10_000,
        inputTokens: 100_000,
        outputTokens: 20_000,
      },
    });

    expect(cost).toBeCloseTo((50_000 * 2 + 40_000 * 0.2 + 10_000 * 2.5 + 20_000 * 10) / MILLION);
  });

  it("bills reasoning once, inside the output tokens", () => {
    const withReasoning = computeCallCostUsd({
      model: "anthropic/claude-opus-5.5",
      usage: { inputTokens: 1000, outputTokens: 500 },
    });

    expect(withReasoning).toBeCloseTo((1000 * 4 + 500 * 20) / MILLION);
  });

  it("charges a flex call about half and a priority call about twice the standard price", () => {
    const usage = { inputTokens: 10_000, outputTokens: 2000 };
    const standard = computeCallCostUsd({ model: "openai/gpt-6-sol", usage }) ?? 0;

    expect(
      computeCallCostUsd({ model: "openai/gpt-6-sol", serviceTier: "flex", usage }),
    ).toBeCloseTo(standard / 2);

    expect(
      computeCallCostUsd({ model: "openai/gpt-6-sol", serviceTier: "priority", usage }),
    ).toBeCloseTo(standard * 2);
  });

  it("scales a rate the tier doesn't list from the standard one", () => {
    // Flex lists no cache-write rate for Sol, so it's half the standard $2.50.
    const cost = computeCallCostUsd({
      model: "openai/gpt-6-sol",
      serviceTier: "flex",
      usage: { cacheWriteTokens: 100_000, inputTokens: 100_000 },
    });

    expect(cost).toBeCloseTo(0.125);
  });

  it("switches to the long-context rates once the prompt passes the threshold", () => {
    const cost = computeCallCostUsd({
      model: "openai/gpt-6-sol",
      usage: { inputTokens: 300_000, outputTokens: 0 },
    });

    expect(cost).toBeCloseTo((300_000 * 4) / MILLION);
  });

  it("prices calls billed by length", () => {
    expect(
      computeCallCostUsd({ model: "openai/gpt-live-1", usage: { audioSeconds: 60 } }),
    ).toBeCloseTo(0.05);

    expect(
      computeCallCostUsd({ model: "openai/gpt-transcribe", usage: { audioSeconds: 120 } }),
    ).toBeCloseTo(0.009);
  });

  it("prices Gemini speech by its audio tokens, 25 a second, and the text it reads", () => {
    // Gemini 3.8 Flash TTS: $0.50 per million text tokens in, $9 per million audio tokens out.
    const usage = { audioSeconds: 4, inputTokens: 100 };

    expect(computeCallCostUsd({ model: "google/gemini-3.8-flash-tts", usage })).toBeCloseTo(
      (4 * 25 * 9 + 100 * 0.5) / MILLION,
      CENT_FRACTION_DIGITS,
    );

    expect(computeCallCostUsd({ model: "google/gemini-3.8-flash-lite-tts", usage })).toBeCloseTo(
      (4 * 25 * 6 + 100 * 0.5) / MILLION,
      CENT_FRACTION_DIGITS,
    );
  });

  it("prices a call at the price of its day, so an announced change applies from that day on", () => {
    // Google doubles its speech prices on 1 January 2027.
    const usage = { audioSeconds: 4, inputTokens: 100 };
    const model = "google/gemini-3.8-flash-tts";

    expect(computeCallCostUsd({ at: new Date("2026-12-31T23:00:00Z"), model, usage })).toBeCloseTo(
      (4 * 25 * 9 + 100 * 0.5) / MILLION,
      CENT_FRACTION_DIGITS,
    );

    expect(computeCallCostUsd({ at: new Date("2027-01-01T00:00:00Z"), model, usage })).toBeCloseTo(
      (4 * 25 * 18 + 100 * 1) / MILLION,
      CENT_FRACTION_DIGITS,
    );
  });

  it("prices an image at the size it was drawn when the model prices sizes apart", () => {
    // Nano Banana 2.1: $1.50 per million text tokens in, $0.0336 a 1K image, $0.0504 a 2K one.
    const model = "google/gemini-nano-banana-2.1";

    expect(
      computeCallCostUsd({ model, usage: { imageSize: "2K", images: 1, inputTokens: 1000 } }),
    ).toBeCloseTo(0.0504 + (1000 * 1.5) / MILLION, CENT_FRACTION_DIGITS);

    expect(computeCallCostUsd({ model, usage: { images: 1 } })).toBeCloseTo(0.0336);
  });

  it("leaves the cost unknown for a model without a price, so it never looks free", () => {
    expect(
      computeCallCostUsd({ model: "acme/unknown-model", usage: { inputTokens: 100 } }),
    ).toBeUndefined();
  });
});

describe("the saved gateway price list", () => {
  it("knows every model the gateway listed when the prices were last refreshed", () => {
    expect(GATEWAY_PRICES.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
    expect(GATEWAY_PRICES.models["typesafe-ai/jev"]).toMatchObject({ output: 0 });
  });
});
