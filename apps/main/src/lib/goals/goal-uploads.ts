"use client";

import { getBrowserApiUrl } from "@/lib/browser-api-url";
import { type AttachOutcome } from "@zoonk/learn/onboarding/actions";
import { getUsageRefusal } from "@zoonk/player/usage-refusal";
import { safeAsync } from "@zoonk/utils/error";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { getSourceUploadFolder } from "@zoonk/utils/user-blobs";
import { postFromBrowser } from "../api/browser-api";
import { getWorkflowAuthHeaders } from "../workflow/auth-headers";

const HTTP_UNAUTHORIZED = 401;
const HTTP_UNPROCESSABLE = 422;

const UPLOAD_ACCESS = "private";

async function toOutcome(response: Response): Promise<AttachOutcome> {
  const body: unknown = await response.json().catch(() => null);
  const source = isJsonObject(body) ? body.source : null;
  const id = getString(source, "id");

  if (response.ok && id) {
    return { source: { id, title: getString(source, "title") ?? "" }, status: "attached" };
  }

  const refusal = getUsageRefusal(body);

  if (refusal?.kind === "usageLimit") {
    return { period: refusal.period, status: "limitReached", tier: refusal.tier };
  }

  if (refusal) {
    return refusal.kind === "slowDown" ? { status: "slowDown" } : { status: "signInRequired" };
  }

  switch (response.status) {
    case HTTP_UNAUTHORIZED:
      return { status: "signInRequired" };
    case HTTP_UNPROCESSABLE:
      return { status: "unsupported" };
    default:
      return { status: "failed" };
  }
}

/** Onboarding's paperclip attaches before the goal exists. */
type AttachGoal = { goalId?: string };

async function registerUpload(body: Record<string, string | undefined>): Promise<AttachOutcome> {
  const response = await postFromBrowser({ body, path: "/v1/uploads" });
  return response ? toOutcome(response) : { status: "failed" };
}

export function attachGoalText({
  goalId,
  language,
  text,
}: AttachGoal & { language: string; text: string }): Promise<AttachOutcome> {
  return registerUpload({ goalId, kind: "text", language, text });
}

export function attachGoalLink({
  goalId,
  language,
  url,
}: AttachGoal & { language: string; url: string }): Promise<AttachOutcome> {
  return registerUpload({ goalId, kind: "link", language, url });
}

export async function attachGoalFile({
  file,
  goalId,
  language,
}: AttachGoal & { file: File; language: string }): Promise<AttachOutcome> {
  // The auth and Blob clients load with the first file, so the screens with a paperclip don't
  // ship them (Blob's brings a JWT library along).
  const { data: clients, error: loadError } = await safeAsync(() =>
    Promise.all([import("@zoonk/auth/client"), import("@vercel/blob/client")]),
  );

  if (loadError) {
    return { status: "failed" };
  }

  const [auth, { uploadPresigned }] = clients;

  const { data: session } = await auth.authClient.getSession();

  if (!session || session.user.isAnonymous) {
    return { status: "signInRequired" };
  }

  const headers = await getWorkflowAuthHeaders();
  // The file must sit right in the folder: a name can't nest folders or climb out with "..". Its
  // own id keeps two files with the same name apart, since an upload never replaces a stored file.
  const fileName = file.name.replaceAll("/", "-").replaceAll(/\.{2,}/gu, ".");
  const pathname = `${getSourceUploadFolder(session.user.id)}${crypto.randomUUID()}-${fileName}`;

  const { data: blob, error } = await safeAsync(() =>
    uploadPresigned(pathname, file, {
      access: UPLOAD_ACCESS,
      handleUploadUrl: `${getBrowserApiUrl()}/v1/uploads/tokens`,
      headers,
    }),
  );

  if (error) {
    return { status: "failed" };
  }

  return registerUpload({ goalId, kind: "file", language, pathname: blob.pathname });
}
