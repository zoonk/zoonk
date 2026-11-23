import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { getRun } from "workflow/api";
import { GET as streamGenerationEvents } from "./route";

const RUN_ID = "wrun_cancelled";
const PAPER = 'mock-paper:goal:["full",1,null]';

const WRITTEN = [
  'data: {"status":"completed","step":"understandGoal"}\n\n',
  'data: {"status":"started","step":"buildSkillGraph"}\n\n',
];

/** A cancelled run's stream holds what it wrote and stays open, as Workflow leaves it. */
function cancelledRun() {
  const getReadable = vi.fn(({ startIndex = 0 }: { startIndex?: number } = {}) =>
    Object.assign(
      new ReadableStream<string>({
        start: (controller) => {
          WRITTEN.slice(startIndex).forEach((chunk) => controller.enqueue(chunk));
        },
      }),
      { getTailIndex: () => Promise.resolve(WRITTEN.length - 1) },
    ),
  );

  vi.mocked(getRun).mockReturnValue({
    exists: Promise.resolve(true),
    getReadable,
    status: Promise.resolve("cancelled"),
  } as unknown as ReturnType<typeof getRun>);

  return getReadable;
}

/** What the stream sent, or null when it was still open a second later. */
async function readEvents(startIndex?: number, namespace?: string): Promise<string | null> {
  const query = new URLSearchParams();

  if (startIndex !== undefined) {
    query.set("startIndex", String(startIndex));
  }

  if (namespace) {
    query.set("namespace", namespace);
  }

  const response = await streamGenerationEvents(
    new NextRequest(`http://localhost/v1/generations/${RUN_ID}/events?${query}`),
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

  it("resumes the requested mock paper stream even after its run ended", async () => {
    const getReadable = cancelledRun();

    await expect(readEvents(1, PAPER)).resolves.toBe(WRITTEN[1]);
    expect(getReadable).toHaveBeenCalledWith({ namespace: PAPER, startIndex: 1 });
  });

  it("resumes an ended run from the event asked for and still ends it", async () => {
    cancelledRun();

    await expect(readEvents(1)).resolves.toBe(WRITTEN[1]);
  });
});
