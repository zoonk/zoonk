import { readFile } from "node:fs/promises";
import { type CodeRunPhase } from "@zoonk/core/library/activities/sandbox-contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestCodeRun } from "./code-run-request";

const api = vi.hoisted(() => ({ response: null as Response | null }));

vi.mock(import("../api/browser-api"), () => ({ postFromBrowser: async () => api.response }));

const RUN_ID = "ec8eedd5-7adf-48aa-b686-ed38e40340b5";
const REQUEST_ID = "afff9e26-a25b-4dba-adb3-18673729ab25";

const done = { error: null, errorOutput: "", output: "hello\n", runId: RUN_ID, stop: "done" };

async function sharedStream(): Promise<string> {
  const fixture = await readFile(
    new URL(
      "../../../../../packages/core/src/library/activities/programs/code-run-events.json",
      import.meta.url,
    ),
    "utf8",
  );

  return asStreamText(JSON.parse(fixture));
}

function asStreamText(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("The shared code run stream is a JSON string");
  }

  return value;
}

function frame(event: "phase" | "result", data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Sent in pieces of a few bytes, so an event arrives split across reads as it does on a phone. */
function streamOf(text: string, { breaksOff = false } = {}): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);

  const pieces = Array.from({ length: Math.ceil(bytes.length / 7) }, (_, index) =>
    bytes.slice(index * 7, index * 7 + 7),
  );

  return new ReadableStream({
    pull(controller) {
      const piece = pieces.shift();

      if (piece) {
        controller.enqueue(piece);
      } else if (breaksOff) {
        controller.error(new TypeError("network connection was lost"));
      } else {
        controller.close();
      }
    },
  });
}

function respond(body: BodyInit | null, init: ResponseInit = {}) {
  api.response = new Response(body, init);
}

function refuse(status: number, error: unknown) {
  api.response = Response.json({ error }, { status });
}

async function run() {
  const phases: CodeRunPhase[] = [];

  const outcome = await requestCodeRun({
    code: 'class Main { public static void main(String[] a) { System.out.println("hello"); } }',
    language: "java",
    onPhase: (phase) => phases.push(phase),
    requestId: REQUEST_ID,
  });

  return { outcome, phases };
}

describe("a program run on our servers", () => {
  afterEach(() => {
    api.response = null;
    vi.useRealTimers();
  });

  it("reports each phase of the shared stream in order, then its result", async () => {
    respond(streamOf(await sharedStream()));

    await expect(run()).resolves.toStrictEqual({
      outcome: { result: done, status: "finished" },
      phases: ["starting", "compiling", "running"],
    });
  });

  it("takes a replay of a finished request, which sends only its result", async () => {
    respond(streamOf(frame("result", done)));

    await expect(run()).resolves.toStrictEqual({
      outcome: { result: done, status: "finished" },
      phases: [],
    });
  });

  it.each([
    {
      error: { line: 3, message: "Main.java:3: error: ';' expected" },
      errorOutput: "Main.java:3: error: ';' expected\n",
      output: "",
      stop: "error",
    },
    { error: null, errorOutput: "", output: "1\n2\n", stop: "timeout" },
    { error: null, errorOutput: "", output: "x".repeat(10_000), stop: "tooMuchOutput" },
  ])("keeps what a program that stops with $stop printed", async (stopped) => {
    const result = { ...stopped, runId: RUN_ID };
    respond(streamOf(frame("phase", { phase: "running" }) + frame("result", result)));

    await expect(run()).resolves.toStrictEqual({
      outcome: { result, status: "finished" },
      phases: ["running"],
    });
  });

  it("can't run when the server couldn't start one", async () => {
    const unavailable = { error: null, errorOutput: "", output: "", runId: RUN_ID };
    respond(streamOf(frame("result", { ...unavailable, stop: "unavailable" })));

    await expect(run()).resolves.toMatchObject({ outcome: { status: "unavailable" } });
  });

  it("counts a stream that breaks off before its result as offline, so the same run is asked again", async () => {
    const started = frame("phase", { phase: "starting" }) + frame("phase", { phase: "compiling" });
    respond(streamOf(started, { breaksOff: true }));

    await expect(run()).resolves.toStrictEqual({
      outcome: { status: "offline" },
      phases: ["starting", "compiling"],
    });
  });

  it("counts a stream that ends without a result as offline", async () => {
    respond(streamOf(frame("phase", { phase: "starting" })));
    await expect(run()).resolves.toMatchObject({ outcome: { status: "offline" } });
  });

  it("is offline when the request never reaches the server", async () => {
    api.response = null;
    await expect(run()).resolves.toStrictEqual({ outcome: { status: "offline" }, phases: [] });
  });

  it("ignores a phase it doesn't know and can't run on a result it can't read", async () => {
    respond(streamOf(frame("phase", { phase: "linking" }) + frame("result", { stop: "done" })));

    await expect(run()).resolves.toStrictEqual({ outcome: { status: "unavailable" }, phases: [] });
  });

  it("waits while another run of the learner's is going", async () => {
    refuse(409, { code: "ALREADY_RUNNING", message: "A program is already running" });
    await expect(run()).resolves.toMatchObject({ outcome: { status: "alreadyRunning" } });
  });

  it.each([
    {
      error: { code: "SIGN_UP_REQUIRED", message: "Create an account" },
      expected: { status: "signUpRequired" },
      status: 403,
    },
    {
      error: {
        code: "USAGE_LIMIT_REACHED",
        details: { limit: { period: "day", tier: "free" } },
        message: "This plan's limit is reached",
      },
      expected: { period: "day", status: "limitReached", tier: "free" },
      status: 402,
    },
    {
      error: {
        code: "USAGE_LIMIT_REACHED",
        details: { limit: { period: "total", tier: "guest" } },
        message: "This plan's limit is reached",
      },
      expected: { period: "total", status: "limitReached", tier: "guest" },
      status: 403,
    },
    {
      error: {
        code: "USAGE_LIMIT_REACHED",
        details: { limit: { period: "day", tier: "plus" } },
        message: "This plan's limit is reached",
      },
      expected: { period: "day", status: "limitReached", tier: "plus" },
      status: 429,
    },
    {
      error: {
        code: "SLOW_DOWN",
        details: { retryAfterSeconds: 5 },
        message: "Take a short break, then try again",
      },
      expected: { retryAfterSeconds: 5, status: "slowDown" },
      status: 429,
    },
  ])("shows the refusal $error.code with $status", async ({ error, expected, status }) => {
    refuse(status, error);
    await expect(run()).resolves.toStrictEqual({ outcome: expected, phases: [] });
  });

  it("keeps when more runs come back for a monthly cap, stamped with when it arrived", async () => {
    vi.useFakeTimers({ now: new Date("2026-12-02T09:00:30.000Z"), toFake: ["Date"] });

    refuse(402, {
      code: "USAGE_LIMIT_REACHED",
      details: {
        limit: { availableAt: "2026-12-04T09:00:00.000Z", period: "rolling30Days", tier: "free" },
      },
      message: "This plan's limit is reached",
    });

    await expect(run()).resolves.toMatchObject({
      outcome: {
        availableAt: "2026-12-04T09:00:00.000Z",
        period: "rolling30Days",
        receivedAt: Date.parse("2026-12-02T09:00:30.000Z"),
        status: "limitReached",
      },
    });
  });

  it.each([
    { code: "VALIDATION_ERROR", status: 400 },
    { code: "UNAUTHORIZED", status: 401 },
    { code: "INTERNAL_ERROR", status: 500 },
  ])("can't run when the server refuses with $code", async ({ code, status }) => {
    refuse(status, { code, message: "No" });
    await expect(run()).resolves.toMatchObject({ outcome: { status: "unavailable" } });
  });
});
