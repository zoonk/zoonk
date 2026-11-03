import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { type Server, createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium } from "@playwright/test";
import { afterAll, beforeAll, describe, it } from "vitest";
import { assertBrowserLaunchAllowed } from "../../packages/testing/src/browser-preflight.ts";
import { readCapture } from "./media.mts";
import { type Steps, captureSide, visitPaths } from "./record.mts";

const PAGE = `<!doctype html>
<meta name="viewport" content="width=device-width">
<h1>Lesson</h1>
<button onclick="this.textContent = 'Correct'">Check</button>`;

const LOADING_PAGE = `<!doctype html>
<p>Loading</p>
<script>fetch("/slow").then(() => { document.querySelector("p").textContent = "Ready"; });</script>`;

const WEBM_SIGNATURE = Buffer.from("1a45dfa3", "hex");
const PNG_WIDTH_OFFSET = 16;
const PNG_HEIGHT_OFFSET = 20;
const NOT_FOUND = 404;
// A shot that doesn't wait beats this even on a busy runner; one that waits for quiet (up to 10 s)
// sees the answer.
const SLOW_RESPONSE_MS = 5000;
const TIMEOUT_MS = 60_000;

const checkAnswer: Steps = async ({ page, shot }) => {
  await page.goto("/");
  await shot("Start");
  await page.getByRole("button", { name: "Check" }).tap();
  await shot("checked");
};

function pngSize(png: Buffer) {
  return { height: png.readUInt32BE(PNG_HEIGHT_OFFSET), width: png.readUInt32BE(PNG_WIDTH_OFFSET) };
}

const shootLoading: Steps = async ({ page, shot }) => {
  await page.goto("/loading");
  await shot("loading", { settle: false });
  await shot("ready");
};

const shootTwice: Steps = async ({ page, shot }) => {
  await page.goto("/");
  await shot("lesson");
  await shot("Lesson");
};

let browser: Browser;
let server: Server;
let baseUrl: string;
let out: string;

beforeAll(async () => {
  assertBrowserLaunchAllowed();
  out = await mkdtemp(join(tmpdir(), "pr-media-"));

  server = createServer((request, response) => {
    if (request.url === "/slow") {
      setTimeout(() => response.end(), SLOW_RESPONSE_MS);
      return;
    }

    if (request.url === "/missing") {
      response.statusCode = NOT_FOUND;
    }

    response.end(request.url === "/loading" ? LOADING_PAGE : PAGE);
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" ? address?.port : ""}`;
  browser = await chromium.launch(process.env.CI ? { channel: "chrome" } : {});
}, TIMEOUT_MS);

afterAll(async () => {
  await browser?.close();
  server?.close();
  await rm(out, { force: true, recursive: true });
});

describe("capturing one side of a PR's before and after", () => {
  it(
    "records the flow on a phone, with its shots at the phone's resolution and no pointer in them",
    async () => {
      const recorded = join(out, "recorded");
      const still = join(out, "still");

      const scene = {
        baseUrl,
        browser,
        schemes: ["light" as const],
        viewports: ["phone" as const],
      };

      const items = await captureSide({
        ...scene,
        out: recorded,
        side: "after",
        steps: checkAnswer,
        video: true,
      });

      await captureSide({ ...scene, out: still, side: "after", steps: checkAnswer, video: false });

      assert.deepEqual(
        items.map((item) => item.file),
        ["phone/light/start.png", "phone/light/checked.png", "phone/light.webm"],
      );

      assert.deepEqual(await readCapture(join(recorded, "after")), items);

      const [shotWhileRecording, shotAlone, recording] = await Promise.all([
        readFile(join(recorded, "after/phone/light/checked.png")),
        readFile(join(still, "after/phone/light/checked.png")),
        readFile(join(recorded, "after/phone/light.webm")),
      ]);

      assert.deepEqual(pngSize(shotWhileRecording), { height: 2532, width: 1170 });
      assert.ok(shotWhileRecording.equals(shotAlone), "the recording's pointer reached a shot");
      assert.ok(recording.subarray(0, WEBM_SIGNATURE.length).equals(WEBM_SIGNATURE), "not a WebM");
    },
    TIMEOUT_MS,
  );

  it(
    "names each path's shot after it and replaces what an earlier capture left",
    async () => {
      const stale = join(out, "paths/before/laptop/light/old.png");
      await mkdir(join(out, "paths/before/laptop/light"), { recursive: true });
      await writeFile(stale, "");

      const items = await captureSide({
        baseUrl,
        browser,
        out: join(out, "paths"),
        schemes: ["light"],
        side: "before",
        steps: visitPaths(["/", "/plan?tab=2"]),
        video: false,
        viewports: ["laptop"],
      });

      assert.deepEqual(
        items.map((item) => item.file),
        ["laptop/light/home.png", "laptop/light/plan.png"],
      );

      await assert.rejects(readFile(stale), { code: "ENOENT" });
    },
    TIMEOUT_MS,
  );

  it(
    "refuses a path that answers with an error instead of shooting the error page",
    async () => {
      await assert.rejects(
        captureSide({
          baseUrl,
          browser,
          out: join(out, "missing"),
          schemes: ["light"],
          side: "after",
          steps: visitPaths(["/missing"]),
          video: false,
          viewports: ["laptop"],
        }),
        /\/missing ended at .+ with 404/u,
      );
    },
    TIMEOUT_MS,
  );

  it(
    "shoots a loading state when told not to wait for the page to settle",
    async () => {
      await captureSide({
        baseUrl,
        browser,
        out: join(out, "loading"),
        schemes: ["light"],
        side: "after",
        steps: shootLoading,
        video: false,
        viewports: ["laptop"],
      });

      const [early, settled] = await Promise.all(
        ["loading", "ready"].map(async (name) =>
          readFile(join(out, `loading/after/laptop/light/${name}.png`)),
        ),
      );

      assert.ok(early && settled && !early.equals(settled), "both shots show the same moment");
    },
    TIMEOUT_MS,
  );

  it(
    "keeps the last good capture when a run fails, such as on two shots with one name",
    async () => {
      const scene = {
        baseUrl,
        browser,
        out: join(out, "kept"),
        schemes: ["light" as const],
        side: "after" as const,
        video: false,
        viewports: ["laptop" as const],
      };

      const good = await captureSide({ ...scene, steps: visitPaths(["/"]) });
      await assert.rejects(captureSide({ ...scene, steps: shootTwice }), /its own name/u);

      assert.deepEqual(await readCapture(join(out, "kept/after")), good);
      await readFile(join(out, "kept/after/laptop/light/home.png"));
    },
    TIMEOUT_MS,
  );
});
