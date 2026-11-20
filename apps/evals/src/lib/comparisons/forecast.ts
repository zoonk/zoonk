import { getCallCost } from "../cost";
import { pricesFor } from "./reader-prices";
import { type Manifest, type Reader } from "./schemas";

const outputTokensByModel: Record<string, number> = {
  "anthropic/claude-haiku-5.5": 10_000,
  "google/gemini-4-neon": 18_000,
  "openai/gpt-6-luna": 4000,
};

const tokens = (value: unknown) => Math.ceil(JSON.stringify(value).length / 4);

export async function forecastReads(
  selection: Pick<
    Manifest,
    "cases" | "readers" | "controls" | "criteria" | "protocols" | "reserveCap"
  >,
  slots: Manifest["runsCompared"],
  blobs: Map<string, string | Buffer>,
  paired: boolean,
  generate: boolean,
) {
  const matched = slots.filter(
    (slot) =>
      (slot.challenger || generate) &&
      (!paired || slot.incumbent) &&
      (!slot.challenger ||
        !slot.incumbent ||
        slot.challenger.userPromptHash === slot.incumbent.userPromptHash),
  );

  const inputTokens = matched.map((slot, index) => {
    const testCase = selection.cases.find((item) => item.id === slot.caseId);
    const bank = selection.controls.pairs[index % selection.controls.pairs.length];

    const outputTokens = (key: string | undefined) => {
      const value = blobs.get(key ?? "");
      return typeof value === "string" ? tokens(value) : 2000;
    };

    const rival = outputTokens(slot.incumbent?.hash);
    const challenger = slot.challenger ? outputTokens(slot.challenger.hash) : rival;

    return (
      tokens(selection.protocols.reader) +
      tokens(selection.criteria) +
      2 * tokens(testCase) +
      tokens(bank) +
      3 * challenger +
      (paired ? rival : 0)
    );
  });

  const prices = await pricesFor(
    selection.readers.filter((reader) => reader.channel !== "owner").map((reader) => reader.model),
  );

  const estimate = (reader: Reader) => {
    let packets = matched.length + (paired ? Math.ceil(matched.length / 2) : 0);

    if (reader.reserve) {
      packets = Math.min(Math.ceil(matched.length / 3), selection.reserveCap ?? Infinity);
    }

    if (reader.channel === "owner") {
      packets = new Set(matched.map((slot) => slot.caseId)).size;
    }

    const mean = inputTokens.reduce((a, b) => a + b, 0) / Math.max(inputTokens.length, 1);

    const gatewayUsd =
      reader.channel === "owner" || packets === 0
        ? 0
        : packets *
          getCallCost({
            modelId: reader.model,
            prices,
            usage: {
              inputTokens: Math.ceil(mean),
              outputTokens: outputTokensByModel[reader.model] ?? 4000,
            },
          });

    return {
      estimatedUsd: reader.channel === "seat" ? 0 : gatewayUsd,
      gatewayFallbackUsd: reader.channel === "seat" ? gatewayUsd : 0,
      packets,
      reader,
    };
  };

  return selection.readers.map(estimate);
}

export function confirmForecast(
  byReader: Awaited<ReturnType<typeof forecastReads>>,
  generation: number | null,
  limit: number,
  confirm: boolean,
) {
  const usd =
    (generation ?? 0) +
    byReader.reduce((accumulator, record) => accumulator + record.estimatedUsd, 0);

  process.stdout.write(
    `${JSON.stringify({
      forecast: {
        byReader,
        conditional:
          "Estimates reverse reads on half of matched pairs and reserve reads on a third, up to the cap. Answer-key solves, verification and seat fallback are additional.",
        generation,
        initialGatewayUsd: usd,
      },
    })}\n`,
  );

  if ((generation === null || usd > limit) && !confirm) {
    throw new Error("Forecast exceeds --limit-usd. Confirm with --confirm.");
  }
}
