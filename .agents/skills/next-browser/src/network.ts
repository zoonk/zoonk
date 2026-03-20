import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page, Request, Response } from "playwright";

const BODY_INLINE_LIMIT = 4000;

type Entry = {
  req: Request;
  res: Response | null;
  ms: number | null;
};

let entries: Entry[] = [];
let startTime = new Map<Request, number>();

export function attach(page: Page) {
  page.on("request", (req) => {
    if (req.resourceType() === "document" && req.frame() === page.mainFrame()) {
      clear();
    }
    startTime.set(req, Date.now());
  });

  page.on("response", (res) => {
    const req = res.request();
    const t0 = startTime.get(req);
    if (t0 == null) return;
    entries.push({ req, res, ms: Date.now() - t0 });
  });

  page.on("requestfailed", (req) => {
    if (!startTime.has(req)) return;
    entries.push({ req, res: null, ms: null });
  });
}

export function clear() {
  entries = [];
  startTime = new Map();
}

export async function detail(idx: number): Promise<string> {
  const e = entries[idx];
  if (!e) throw new Error(`no request at index ${idx}`);

  const { req, res, ms } = e;
  const lines: string[] = [
    `${req.method()} ${req.url()}`,
    `type: ${req.resourceType()}${ms != null ? `  ${ms}ms` : ""}`,
    "",
    "request headers:",
    ...indent(await req.allHeaders()),
  ];

  const postData = req.postData();
  if (postData) {
    lines.push("", "request body:", truncate(postData, 2000));
  }

  if (!res) {
    lines.push("", `FAILED: ${req.failure()?.errorText ?? "unknown"}`);
    return lines.join("\n");
  }

  lines.push(
    "",
    `response: ${res.status()} ${res.statusText()}`,
    "response headers:",
    ...indent(await res.allHeaders()),
  );

  const body = await res.text().catch((err) => `(body unavailable: ${err.message})`);
  lines.push("", "response body:", spillIfLong(body, idx, res));

  return lines.join("\n");
}

function indent(headers: Record<string, string>): string[] {
  return Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + `\n… (${s.length - max} more bytes)` : s;
}

function spillIfLong(body: string, idx: number, res: Response): string {
  if (body.length <= BODY_INLINE_LIMIT) return body;
  const ext = extFor(res.headers()["content-type"]);
  const path = join(tmpdir(), `next-browser-${process.pid}-${idx}${ext}`);
  writeFileSync(path, body);
  return `(${body.length} bytes written to ${path})`;
}

function extFor(contentType: string | undefined): string {
  if (!contentType) return ".txt";
  if (contentType.includes("json")) return ".json";
  if (contentType.includes("html")) return ".html";
  if (contentType.includes("javascript")) return ".js";
  if (contentType.includes("x-component")) return ".rsc";
  return ".txt";
}

export function format(): string {
  if (entries.length === 0) return "(no requests)";

  const lines = [
    "# Network requests since last navigation",
    "# Columns: idx status method type ms url [next-action=...]",
    "# Use `network <idx>` for headers and body.",
    "",
  ];

  entries.forEach((e, i) => {
    const { req, res, ms } = e;
    const status = res?.status() ?? "FAIL";
    const time = ms != null ? `${ms}ms` : "-";
    const action = req.headers()["next-action"];
    const suffix = action ? ` next-action=${action}` : "";
    lines.push(
      `${i} ${status} ${req.method()} ${req.resourceType()} ${time} ${req.url()}${suffix}`,
    );
  });

  return lines.join("\n");
}
