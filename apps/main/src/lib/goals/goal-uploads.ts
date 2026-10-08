"use client";

import { uploadPresigned } from "@vercel/blob/client";
import { authClient } from "@zoonk/auth/client";
import { type AttachOutcome } from "@zoonk/learn/onboarding/actions";
import { getUsageRefusal } from "@zoonk/player/usage-refusal";
import { safeAsync } from "@zoonk/utils/error";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { API_URL } from "@zoonk/utils/url";
import { getSourceUploadFolder } from "@zoonk/utils/user-blobs";
import { postFromBrowser } from "../api/browser-api";
import { getWorkflowAuthHeaders } from "../workflow/auth-headers";

const HTTP_UNAUTHORIZED = 401;
const HTTP_UNPROCESSABLE = 422;

/** Uploads go to the private store, which only the server reads. */
const UPLOAD_ACCESS = "private";

/** What the uploads route answered, as the paperclip says it. */
async function toOutcome(response: Response): Promise<AttachOutcome> {
  const body: unknown = await response.json().catch(() => null);
  const source = isJsonObject(body) ? body.source : null;
  const id = getString(source, "id");

  if (response.ok && id) {
    return { source: { id, title: getString(source, "title") ?? "" }, status: "attached" };
  }

  // A plan's cap for the day or the month, or fair use asking for a short break.
  const refusal = getUsageRefusal(body);

  if (refusal) {
    return refusal.kind === "usageLimit"
      ? { period: refusal.period, status: "limitReached", tier: refusal.tier }
      : { status: "slowDown" };
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

/**
 * The goal the material is for, when the goal already exists (the notice research asked for), so
 * the upload is linked to it. Onboarding's paperclip attaches before the goal exists.
 */
type AttachGoal = { goalId?: string };

/** Registers the material with `POST /v1/uploads`, which checks the plan's upload allowance. */
async function registerUpload(body: Record<string, string | undefined>): Promise<AttachOutcome> {
  const response = await postFromBrowser({ body, path: "/v1/uploads" });
  return response ? toOutcome(response) : { status: "failed" };
}

/** Pasted text: the syllabus, notes or a chapter, stored as the learner's own source. */
export function attachGoalText({
  goalId,
  language,
  text,
}: AttachGoal & { language: string; text: string }): Promise<AttachOutcome> {
  return registerUpload({ goalId, kind: "text", language, text });
}

/** A pasted link: an article, a class page or a public PDF, read once as the learner's source. */
export function attachGoalLink({
  goalId,
  language,
  url,
}: AttachGoal & { language: string; url: string }): Promise<AttachOutcome> {
  return registerUpload({ goalId, kind: "link", language, url });
}

/**
 * A file goes straight to Blob storage in the learner's own folder (the API signs the upload,
 * refused once the plan's uploads are used up), then is registered like pasted text.
 */
export async function attachGoalFile({
  file,
  goalId,
  language,
}: AttachGoal & { file: File; language: string }): Promise<AttachOutcome> {
  const { data: session } = await authClient.getSession();

  if (!session || session.user.isAnonymous) {
    return { status: "signInRequired" };
  }

  const headers = await getWorkflowAuthHeaders();
  // The file must sit right in the folder: a name can't nest folders or climb out with "..".
  const fileName = file.name.replaceAll("/", "-").replaceAll(/\.{2,}/gu, ".");
  const pathname = `${getSourceUploadFolder(session.user.id)}${fileName}`;

  const { data: blob, error } = await safeAsync(() =>
    uploadPresigned(pathname, file, {
      access: UPLOAD_ACCESS,
      handleUploadUrl: `${API_URL}/v1/uploads/tokens`,
      headers,
    }),
  );

  if (error) {
    return { status: "failed" };
  }

  return registerUpload({ goalId, kind: "file", language, pathname: blob.pathname });
}
