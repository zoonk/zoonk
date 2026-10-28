import { generateText, streamText } from "ai";
import { describe, expect, it, vi } from "vitest";
import { isTimeoutError } from "../../../evaluate/evaluation-timeout";
import { extractExamBlueprint } from "./extract-exam-blueprint";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./extract-exam-blueprint.prompt.md", () => ({ default: "Read the exam's documents." }));
vi.mock("./extract-question-formats.prompt.md", () => ({ default: "List the formats." }));

vi.mock("./extract-exam-blueprint-reading-again.prompt.md", () => ({
  default: "Include what LEFT_OUT lists.",
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof Ai>()),
  generateText: vi.fn(),
  streamText: vi.fn(),
}));

const notice = {
  file: null,
  images: [],
  text: "Edital nº 1: a prova objetiva terá 120 questões.",
  title: "Edital",
  url: "https://example.gov.br/edital.pdf",
};

function failedStream(error: Error): ReturnType<typeof streamText> {
  const failed = Promise.reject(error);
  failed.catch(() => null);

  return {
    finalStep: failed,
    finishReason: Promise.resolve("error"),
    output: failed,
    steps: failed,
    usage: failed,
  } as unknown as ReturnType<typeof streamText>;
}

function readFailing(corrections?: Parameters<typeof extractExamBlueprint>[0]["corrections"]) {
  return extractExamBlueprint({
    corrections,
    documents: [notice],
    exam: "PF, Agente",
    useFallback: false,
  }).catch(() => null);
}

describe(extractExamBlueprint, () => {
  it("reports a reading whose deadline ran out while the provider's retries waited as a timeout", async () => {
    // The reading's own deadline (`timeout`) ending a retry's wait: the AI SDK throws an
    // AbortError, which a workflow step takes for a cancellation and never retries.
    const aborted = new DOMException("Delay was aborted", "AbortError");

    vi.mocked(streamText).mockImplementation((options) => {
      void options.onError?.({ error: aborted });
      return failedStream(aborted);
    });

    vi.mocked(generateText).mockRejectedValue(new Error("The narrow read failed too"));

    const thrown = await extractExamBlueprint({ documents: [notice], exam: "PF, Agente" }).catch(
      (error: unknown) => error,
    );

    // A timeout is retried by the step (`withAiRetry`) once the provider recovers.
    expect(isTimeoutError(thrown)).toBe(true);
  });

  it("keeps any other failure as the provider reported it", async () => {
    const refused = new Error("The provider refused the request");

    vi.mocked(streamText).mockImplementation((options) => {
      void options.onError?.({ error: refused });
      return failedStream(refused);
    });

    await expect(
      extractExamBlueprint({ documents: [notice], exam: "PF, Agente", useFallback: false }),
    ).rejects.toBe(refused);
  });

  it("reads the rules for reading again only when told what an earlier reading left out", async () => {
    const refused = new Error("The provider refused the request");
    vi.mocked(streamText).mockClear();
    vi.mocked(streamText).mockImplementation(() => failedStream(refused));
    vi.mocked(generateText).mockRejectedValue(new Error("The narrow read failed too"));

    await readFailing();
    await readFailing([{ kind: "countsOffTotal", sum: 100, total: 120 }]);

    expect(vi.mocked(streamText).mock.calls.map(([options]) => options.instructions)).toStrictEqual(
      ["Read the exam's documents.", "Read the exam's documents.\nInclude what LEFT_OUT lists."],
    );
  });

  it("tells a reading again what an earlier one stated that no check could confirm", async () => {
    const refused = new Error("The provider refused the request");
    vi.mocked(streamText).mockClear();
    vi.mocked(streamText).mockImplementation(() => failedStream(refused));
    vi.mocked(generateText).mockRejectedValue(new Error("The narrow read failed too"));

    await readFailing([
      { kind: "unconfirmed", part: "scale", subject: null },
      { kind: "unconfirmed", part: "topics", subject: "Língua Portuguesa" },
    ]);

    const [options] = vi.mocked(streamText).mock.calls.at(-1) ?? [];
    const prompt = JSON.stringify(options?.prompt);

    expect(prompt).toContain("The scale the exam's result is reported on: no passage of `mock`");

    expect(prompt).toContain(
      String.raw`The topics of \"Língua Portuguesa\": none is in the documents`,
    );
  });
});
