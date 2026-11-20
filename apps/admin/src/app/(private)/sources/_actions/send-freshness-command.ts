"use server";

import { postAdminApi } from "@/lib/admin-api";
import { assertAdmin } from "@/lib/admin-guard";
import { parseFormField } from "@zoonk/utils/form";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidatePath } from "next/cache";

type FreshnessCommand = "checkNow" | "readAgain" | "stop";
export type FreshnessTargetKind = "exam" | "source";
type FreshnessResult = "started" | "stopped";

type FreshnessCommandResult = { error: string | null; result: FreshnessResult | null };

function parseCommand(value: string | null): FreshnessCommand | null {
  return value === "checkNow" || value === "readAgain" || value === "stop" ? value : null;
}

function buildTarget({ id, kind }: { id: string | null; kind: string | null }) {
  if (!isUuid(id)) {
    return null;
  }

  if (kind === "exam") {
    return { examBlueprintId: id, kind: "exam" as const };
  }

  return kind === "source" ? { kind: "source" as const, sourceId: id } : null;
}

function readResult(data: unknown): FreshnessResult | null {
  if (typeof data !== "object" || data === null || !("status" in data)) {
    return null;
  }

  const { status } = data;

  return status === "started" || status === "stopped" ? status : null;
}

/** The API may be down locally, so a failed call returns an error message instead of throwing. */
export async function sendFreshnessCommandAction(
  formData: FormData,
): Promise<FreshnessCommandResult> {
  const session = await assertAdmin();
  const command = parseCommand(parseFormField(formData, "command"));
  const targetKind = parseFormField(formData, "targetKind");
  const targetId = parseFormField(formData, "targetId");
  const target = buildTarget({ id: targetId, kind: targetKind });

  if (!(command && target)) {
    return { error: "Invalid freshness command.", result: null };
  }

  const response = await postAdminApi({
    body: { command, target },
    path: "/v1/freshness/commands",
    sessionToken: session.session.token,
  });

  const result = response.ok ? readResult(response.data) : null;

  if (!result) {
    return {
      error: "Could not reach the API. Check that it is running and try again.",
      result: null,
    };
  }

  revalidatePath(target.kind === "exam" ? `/exams/${targetId}` : `/sources/${targetId}`);

  return { error: null, result };
}
