import { FeedbackContentKind } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";

type MessageProvenance = {
  model: string | null;
  promptVersion: string | null;
  runId: string | null;
};

type FeedbackMessageContext = {
  appVersion: string | null;
  contentId: string | null;
  contentKind: FeedbackContentKind | null;
  platform: string | null;
  provenance: MessageProvenance | null;
  screen: string | null;
  url: string | null;
};

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value ? value : null;
}

function readContentKind(record: Record<string, unknown>): FeedbackContentKind | null {
  const value = readString(record, "contentKind");
  return Object.values(FeedbackContentKind).find((kind) => kind === value) ?? null;
}

function readProvenance(value: unknown): MessageProvenance | null {
  if (!isJsonObject(value)) {
    return null;
  }

  return {
    model: readString(value, "model"),
    promptVersion: readString(value, "promptVersion"),
    runId: readString(value, "runId"),
  };
}

/**
 * `submitFeedback` in core stores the context the client sent (screen, url, platform, app version
 * and content) plus the provenance of that content. It is JSON, so each field is read defensively
 * and older or partial rows still render.
 */
export function parseFeedbackMessageContext(context: unknown): FeedbackMessageContext {
  const record = isJsonObject(context) ? context : {};

  return {
    appVersion: readString(record, "appVersion"),
    contentId: readString(record, "contentId"),
    contentKind: readContentKind(record),
    platform: readString(record, "platform"),
    provenance: readProvenance(record.provenance),
    screen: readString(record, "screen"),
    url: readString(record, "url"),
  };
}
