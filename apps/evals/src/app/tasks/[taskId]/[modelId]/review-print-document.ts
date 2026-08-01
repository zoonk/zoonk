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

/** Converts code-shaped object keys into labels that read naturally on paper. */
function formatLabel(label: string): string {
  const words = label
    .replaceAll(/(?<lower>[a-z0-9])(?<upper>[A-Z])/gu, "$<lower> $<upper>")
    .replaceAll(/[_-]+/gu, " ")
    .trim();

  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : "Value";
}

/** Preserves scalar content while replacing JavaScript-only null semantics. */
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

/** Narrows parsed JSON objects before their fields are formatted as plain text. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Places a generated title before its body while preserving every other field's output order. */
function getReadableEntries(value: Record<string, unknown>): [string, unknown][] {
  return Object.entries(value).toSorted(([firstKey], [secondKey]) => {
    if (firstKey === "title") {
      return -1;
    }

    return secondKey === "title" ? 1 : 0;
  });
}

/** Parses structured model output once so the print view can omit JSON syntax. */
function parseOutput(output: string): unknown {
  try {
    return JSON.parse(output) as unknown;
  } catch {
    return output;
  }
}

/** Indents continuation lines so numbered array items remain easy to scan. */
function indentText(text: string): string {
  return text.replaceAll("\n", "\n   ");
}

/** Formats one named value as a label followed by its readable content. */
function formatReadableField({ label, value }: { label: string; value: unknown }): string {
  return `${formatLabel(label).toUpperCase()}\n${formatReadableValue(value)}`;
}

/** Gives one array item a visible reading order without reproducing JSON punctuation. */
function formatReadableArrayItem({ index, value }: { index: number; value: unknown }): string {
  return `${index + 1}. ${indentText(formatReadableValue(value))}`;
}

/** Recursively converts structured output into simple labels, paragraphs, and numbered text. */
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

/** Creates text nodes through the DOM so generated content is never interpreted as HTML. */
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

/** Starts one test case with concise context followed only by its generated output. */
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

  output.append(header, content);
  return output;
}

/** Populates an isolated same-origin window with the selected anonymous review content. */
function populatePrintDocument({
  entries,
  printDocument,
  taskName,
}: {
  entries: ReviewExportEntry[];
  printDocument: Document;
  taskName: string;
}) {
  const charset = printDocument.createElement("meta");
  charset.setAttribute("charset", "utf8");
  const style = printDocument.createElement("style");
  style.textContent = PRINT_STYLES;
  const content = createTextElement({ printDocument, tagName: "main" });

  content.append(
    ...entries.map((entry, index) =>
      createReviewOutput({ entry, index, printDocument, taskName, totalEntries: entries.length }),
    ),
  );

  printDocument.head.replaceChildren(charset, style);
  printDocument.title = `${taskName} outputs`;
  printDocument.body.replaceChildren(content);
}

/** Opens the native print dialog, where the reviewer can print or save the output as a PDF. */
export function printReviewOutputs({
  entries,
  taskName,
}: {
  entries: ReviewExportEntry[];
  taskName: string;
}): boolean {
  const printWindow = window.open("", "_blank", "popup");

  if (!printWindow) {
    return false;
  }

  populatePrintDocument({ entries, printDocument: printWindow.document, taskName });
  printWindow.opener = null;
  printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true });

  printWindow.requestAnimationFrame(() => {
    printWindow.focus();
    printWindow.print();
  });

  return true;
}
