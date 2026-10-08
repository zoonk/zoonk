"use server";

import { postAdminApi } from "@/lib/admin-api";
import { assertAdmin } from "@/lib/admin-guard";
import { parseFormField } from "@zoonk/utils/form";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidatePath } from "next/cache";

type FreshnessCommand = "checkNow" | "stop";
export type FreshnessTargetKind = "exam" | "source";
type FreshnessResult = "started" | "stopped";

export type FreshnessCommandState = {
  command: FreshnessCommand | null;
  error: string | null;
  result: FreshnessResult | null;
  submissionId: number;
};

function parseCommand(value: string | null): FreshnessCommand | null {
  return value === "checkNow" || value === "stop" ? value : null;
}

/** The API names an exam target by its blueprint id and a source target by its source id. */
function buildTarget({ id, kind }: { id: string | null; kind: string | null }) {
  if (!isUuid(id)) {
    return null;
  }

  if (kind === "exam") {
    return { examBlueprintId: id, kind: "exam" as const };
  }

  return kind === "source" ? { kind: "source" as const, sourceId: id } : null;
}

/** The API answers with one of two statuses; anything else is treated as a failure. */
function readResult(data: unknown): FreshnessResult | null {
  if (typeof data !== "object" || data === null || !("status" in data)) {
    return null;
  }

  const { status } = data;

  return status === "started" || status === "stopped" ? status : null;
}

/**
 * Checks an exam or source now, or stops its checks, through the API that owns
 * the workflow. The API may be down locally, so a failed
 * call returns an error message instead of throwing.
 */
export async function sendFreshnessCommandAction(
  previousState: FreshnessCommandState,
  formData: FormData,
): Promise<FreshnessCommandState> {
  const session = await assertAdmin();
  const submissionId = previousState.submissionId + 1;
  const command = parseCommand(parseFormField(formData, "command"));
  const targetKind = parseFormField(formData, "targetKind");
  const targetId = parseFormField(formData, "targetId");
  const target = buildTarget({ id: targetId, kind: targetKind });

  if (!(command && target)) {
    return { command, error: "Invalid freshness command.", result: null, submissionId };
  }

  const response = await postAdminApi({
    body: { command, target },
    path: "/v1/freshness/commands",
    sessionToken: session.session.token,
  });

  const result = response.ok ? readResult(response.data) : null;

  if (!result) {
    return {
      command,
      error: "Could not reach the API. Check that it is running and try again.",
      result: null,
      submissionId,
    };
  }

  revalidatePath(target.kind === "exam" ? `/exams/${targetId}` : `/sources/${targetId}`);

  return { command, error: null, result, submissionId };
}
