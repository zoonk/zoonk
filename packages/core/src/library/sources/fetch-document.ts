import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { normalizeContentType } from "@zoonk/utils/upload";
import { type Response, fetch } from "undici";
import { fetchCompletingChain, isMissingIssuerError } from "./_utils/issuer-certificates";
import { isPublicUrl, publicAgent } from "./_utils/public-url";
import { readLimitedBody } from "./_utils/read-limited-body";
import { MAX_SOURCE_UPLOAD_BYTES } from "./source-contract";

const FETCH_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set(["301", "302", "303", "307", "308"]);
const USER_AGENT = "Mozilla/5.0 (compatible; ZoonkBot/1.0; +https://www.zoonk.com)";

export type FetchedDocument = { bytes: Uint8Array; contentType: string; url: string };

export function toSourceUrl(value: string): string | null {
  if (!URL.canParse(value)) {
    return null;
  }

  const url = new URL(value);

  if (!isPublicUrl(url)) {
    return null;
  }

  url.hash = "";

  return url.toString();
}

/** Retry only a missing intermediate certificate; chain validation must still reach a trusted root. */
async function requestPage(url: string): Promise<Response> {
  const headers = { "user-agent": USER_AGENT };
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);

  const { data: response, error } = await safeAsync(() =>
    fetch(url, { dispatcher: publicAgent, headers, redirect: "manual", signal }),
  );

  if (!error) {
    return response;
  }

  if (!isMissingIssuerError(error)) {
    throw error;
  }

  return fetchCompletingChain({ headers, signal, url });
}

/** Validate each redirect so a public page cannot send a request to a private address. */
async function fetchPublicUrl({ redirects, url }: { redirects: number; url: string }) {
  const sourceUrl = toSourceUrl(url);

  if (!sourceUrl) {
    throw new Error(`Refusing to fetch a non-public address: ${url}`);
  }

  const response = await requestPage(sourceUrl);
  const location = response.headers.get("location");

  if (REDIRECT_STATUSES.has(String(response.status)) && location) {
    // A redirect's body is never read; cancelling it frees the connection now, not at the timeout.
    await response.body?.cancel();

    if (redirects >= MAX_REDIRECTS) {
      throw new Error(`Too many redirects fetching ${sourceUrl}`);
    }

    return fetchPublicUrl({
      redirects: redirects + 1,
      url: new URL(location, sourceUrl).toString(),
    });
  }

  return { response, url: sourceUrl };
}

/** Throws on failed HTTP status so the workflow step can retry. */
export async function fetchDocument(url: string): Promise<FetchedDocument> {
  const fetched = await fetchPublicUrl({ redirects: 0, url });

  if (!fetched.response.ok) {
    await fetched.response.body?.cancel();
    throw new Error(`Fetching ${fetched.url} failed with status ${fetched.response.status}`);
  }

  return {
    bytes: await readLimitedBody({ maxBytes: MAX_SOURCE_UPLOAD_BYTES, response: fetched.response }),
    contentType: normalizeContentType(fetched.response.headers.get("content-type") ?? ""),
    url: fetched.url,
  };
}
