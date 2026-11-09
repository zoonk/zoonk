import {
  type EvalSummary,
  HISTORICAL_ATTEMPTS_NOTE,
  formatFailureCounts,
  formatKeyFlaws,
  getCaseHref,
} from "@/lib/eval-summary";
import { type ReviewExportEntry } from "@/lib/review-export";

const PRINT_STYLES = `
  @page {
    margin: 16mm 18mm;
    size: A4;
  }

  * {
    box-sizing: border-box;
  }

  html {
    color: #18181b;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 11pt;
    line-height: 1.55;
  }

  body {
    margin: 0;
  }

  .output {
    break-before: page;
  }

  .output:first-child {
    break-before: auto;
  }

  .output-header {
    border-bottom: 1px solid #e4e4e7;
    margin-bottom: 24px;
    padding-bottom: 16px;
  }

  .output-count,
  .output-meta {
    color: #71717a;
    font-size: 9pt;
  }

  .output-count {
    letter-spacing: 0.08em;
    margin: 0 0 8px;
    text-transform: uppercase;
  }

  h1 {
    font-size: 20pt;
    line-height: 1.2;
    margin: 0;
  }

  .output-meta {
    margin: 8px 0 0;
  }

  .output-content {
    font: inherit;
    margin: 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
`;

type PrintTagName = "h1" | "header" | "main" | "p" | "pre" | "section";

function formatLabel(label: string): string {
  const words = label
    .replaceAll(/(?<lower>[a-z0-9])(?<upper>[A-Z])/gu, "$<lower> $<upper>")
    .replaceAll(/[_-]+/gu, " ")
    .trim();

  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : "Value";
}

function formatPrimitive(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }

  return "None";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getReadableEntries(value: Record<string, unknown>): [string, unknown][] {
  return Object.entries(value).toSorted(([firstKey], [secondKey]) => {
    if (firstKey === "title") {
      return -1;
    }

    return secondKey === "title" ? 1 : 0;
  });
}

function parseOutput(output: string): unknown {
  try {
    return JSON.parse(output) as unknown;
  } catch {
    return output;
  }
}

function indentText(text: string): string {
  return text.replaceAll("\n", "\n   ");
}

function formatReadableField({ label, value }: { label: string; value: unknown }): string {
  return `${formatLabel(label).toUpperCase()}\n${formatReadableValue(value)}`;
}

function formatReadableArrayItem({ index, value }: { index: number; value: unknown }): string {
  return `${index + 1}. ${indentText(formatReadableValue(value))}`;
}

function formatReadableValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((arrayValue, index) => formatReadableArrayItem({ index, value: arrayValue }))
      .join("\n\n");
  }

  if (isRecord(value)) {
    return getReadableEntries(value)
      .map(([label, nestedValue]) => formatReadableField({ label, value: nestedValue }))
      .join("\n\n");
  }

  return formatPrimitive(value);
}

function createTextElement({
  className,
  printDocument,
  tagName,
  text,
}: {
  className?: string;
  printDocument: Document;
  tagName: PrintTagName;
  text?: string;
}): HTMLElement {
  const element = printDocument.createElement(tagName);
  element.className = className ?? "";

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function createReviewOutput({
  entry,
  index,
  printDocument,
  taskName,
  totalEntries,
}: {
  entry: ReviewExportEntry;
  index: number;
  printDocument: Document;
  taskName: string;
  totalEntries: number;
}): HTMLElement {
  const output = createTextElement({ className: "output", printDocument, tagName: "section" });

  const header = createTextElement({
    className: "output-header",
    printDocument,
    tagName: "header",
  });

  header.append(
    createTextElement({
      className: "output-count",
      printDocument,
      tagName: "p",
      text: `Output ${index + 1} of ${totalEntries}`,
    }),
    createTextElement({ printDocument, tagName: "h1", text: taskName }),
    createTextElement({
      className: "output-meta",
      printDocument,
      tagName: "p",
      text: `${entry.testCaseId} · ${entry.language.toUpperCase()}`,
    }),
  );

  const content = createTextElement({
    className: "output-content",
    printDocument,
    tagName: "pre",
    text: formatReadableValue(parseOutput(entry.output)),
  });

  const flaws = createTextElement({
    className: "output-content",
    printDocument,
    tagName: "pre",
    text: `Judge-flagged key flaws: ${entry.keyFlaws === undefined ? "not recorded" : entry.keyFlaws.length}\n${(entry.keyFlaws ?? []).map((flaw) => `${flaw.itemLocator}: ${flaw.kind}\nKeyed answer: ${flaw.keyedAnswer}\nJudge's worked answer: ${flaw.workedAnswer}`).join("\n\n")}`,
  });

  output.append(header, flaws, content);
  return output;
}

function populatePrintDocument({
  entries,
  printDocument,
  taskName,
  summary,
  modelId,
  taskId,
}: {
  entries: ReviewExportEntry[];
  printDocument: Document;
  taskName: string;
  summary: EvalSummary;
  modelId: string;
  taskId: string;
}) {
  const charset = printDocument.createElement("meta");
  charset.setAttribute("charset", "utf8");
  const style = printDocument.createElement("style");
  style.textContent = PRINT_STYLES;
  const content = createTextElement({ printDocument, tagName: "main" });

  const summarySection = createTextElement({ printDocument, tagName: "section" });

  summarySection.append(
    createTextElement({ printDocument, tagName: "h1", text: `${taskName}: all saved runs` }),
  );

  summarySection.append(
    createTextElement({
      className: "output-content",
      printDocument,
      tagName: "pre",
      text: [
        `Average score (scored outputs): ${summary.averageScore?.toFixed(2) ?? "Unscored"}`,
        `Attempted (recorded): ${summary.attempted}; generated: ${summary.generated}; scored: ${summary.scored}`,
        `Generation failures: ${formatFailureCounts(summary)}`,
        `Judge-flagged key flaws: ${formatKeyFlaws(summary)}`,
        HISTORICAL_ATTEMPTS_NOTE,
      ].join("\n"),
    }),
  );

  for (const caseId of summary.caseIds.attempted) {
    const link = printDocument.createElement("a");
    link.href = new URL(getCaseHref({ caseId, modelId, taskId }), globalThis.location.origin).href;
    link.textContent = caseId;
    summarySection.append(link, printDocument.createElement("br"));
  }

  content.append(summarySection);

  content.append(
    ...entries.map((entry, index) =>
      createReviewOutput({ entry, index, printDocument, taskName, totalEntries: entries.length }),
    ),
  );

  printDocument.head.replaceChildren(charset, style);
  printDocument.title = `${taskName} outputs`;
  printDocument.body.replaceChildren(content);
}

export function printReviewOutputs({
  entries,
  taskName,
  summary,
  modelId,
  taskId,
}: {
  entries: ReviewExportEntry[];
  taskName: string;
  summary: EvalSummary;
  modelId: string;
  taskId: string;
}): boolean {
  const printWindow = window.open("", "_blank", "popup");

  if (!printWindow) {
    return false;
  }

  populatePrintDocument({
    entries,
    modelId,
    printDocument: printWindow.document,
    summary,
    taskId,
    taskName,
  });

  printWindow.opener = null;
  printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true });

  printWindow.requestAnimationFrame(() => {
    printWindow.focus();
    printWindow.print();
  });

  return true;
}
