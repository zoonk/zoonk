import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { getRun } from "workflow/api";
import { GET as streamGenerationEvents } from "./route";

const RUN_ID = "wrun_cancelled";

const WRITTEN = [
  'data: {"status":"completed","step":"understandGoal"}\n\n',
  'data: {"status":"started","step":"buildSkillGraph"}\n\n',
];

/** A cancelled run's stream holds what it wrote and stays open, as Workflow leaves it. */
function cancelledRun() {
  vi.mocked(getRun).mockReturnValue({
    exists: Promise.resolve(true),
    getReadable: ({ startIndex = 0 }: { startIndex?: number } = {}) =>
      Object.assign(
        new ReadableStream<string>({
          start: (controller) => {
            WRITTEN.slice(startIndex).forEach((chunk) => controller.enqueue(chunk));
          },
        }),
        { getTailIndex: () => Promise.resolve(WRITTEN.length - 1) },
      ),
    status: Promise.resolve("cancelled"),
  } as unknown as ReturnType<typeof getRun>);
}

/** What the stream sent, or null when it was still open a second later. */
async function readEvents(startIndex?: number): Promise<string | null> {
  const query = startIndex === undefined ? "" : `?startIndex=${startIndex}`;

  const response = await streamGenerationEvents(
    new NextRequest(`http://localhost/v1/generations/${RUN_ID}/events${query}`),
    { params: Promise.resolve({ generationId: RUN_ID }) },
  );

  let text = "";

  const sink = new WritableStream<string>({
    write: (chunk) => {
      text += chunk;
    },
  });

  const ended = await (response.body as unknown as ReadableStream<string>)
    .pipeTo(sink, { signal: AbortSignal.timeout(1000) })
    .then(
      () => true,
      () => false,
    );

  return ended ? text : null;
}

describe("GET /v1/generations/{generationId}/events", () => {
  it("ends a run that already ended after what it wrote, though its stream stays open", async () => {
    cancelledRun();

    await expect(readEvents()).resolves.toBe(WRITTEN.join(""));
  });

  it("resumes an ended run from the event asked for and still ends it", async () => {
    cancelledRun();

    await expect(readEvents(1)).resolves.toBe(WRITTEN[1]);
  });
});
