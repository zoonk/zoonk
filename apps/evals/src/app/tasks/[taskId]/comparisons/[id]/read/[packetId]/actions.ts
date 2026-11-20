"use server";

import { importVerdicts } from "@/lib/comparisons/packets";
import { type Packet, identifier } from "@/lib/comparisons/schemas";
import { listComparisons, loadComparison } from "@/lib/comparisons/storage";
import { parseFormField } from "@zoonk/utils/form";
import { logError } from "@zoonk/utils/logger";
import { revalidatePath } from "next/cache";
import { comparisonPath, readPath } from "../../../_utils/paths";

type Pair = Packet["pairs"][number];
type Criterion = Packet["criteria"][number];

export type BlindReadResult = { error: string } | { failures: string[]; passed: boolean };

const NO_REASON = "No reason given.";
const WHOLE_ANSWER = "The whole answer.";

function field(formData: FormData, pair: Pair, name: string): string {
  return parseFormField(formData, `${pair.pairId}:${name}`) ?? "";
}

function location(where: string, output: string) {
  if (!where) {
    return { detail: WHOLE_ANSWER, kind: "whole" as const };
  }

  return { detail: where, kind: output.includes(where) ? ("quote" as const) : ("range" as const) };
}

/** The problems a pair's form lists, in the order they were added. */
function observations(formData: FormData, pair: Pair) {
  const prefix = `${pair.pairId}:problem-`;

  const keys = [...formData.keys()]
    .filter((key) => key.startsWith(prefix) && key.endsWith(":claim"))
    .map((key) => key.slice(`${pair.pairId}:`.length, -":claim".length));

  return keys.map((key) => {
    const output = pair.B === null ? "A" : field(formData, pair, `${key}:output`);

    return {
      claim: field(formData, pair, `${key}:claim`),
      criterion: field(formData, pair, `${key}:criterion`),
      learnerCost: field(formData, pair, `${key}:cost`),
      location: location(
        field(formData, pair, `${key}:where`),
        output === "B" ? (pair.B ?? "") : pair.A,
      ),
      output,
      severity: field(formData, pair, `${key}:severity`),
    };
  });
}

function verdict(formData: FormData, pair: Pair, criteria: Criterion[]) {
  if (pair.B === null) {
    return {
      criteria: [],
      observations: observations(formData, pair),
      overall: null,
      pairId: pair.pairId,
    };
  }

  return {
    criteria: criteria.map((criterion) => ({
      criterion: criterion.id,
      preference: field(formData, pair, `criterion-${criterion.id}`),
      reason: field(formData, pair, `criterion-${criterion.id}-reason`) || NO_REASON,
    })),
    observations: observations(formData, pair),
    overall: {
      preference: field(formData, pair, "overall"),
      reason: field(formData, pair, "overall-reason"),
    },
    pairId: pair.pairId,
  };
}

async function findOwnerPacket(taskId: string, id: string, packetId: string) {
  const ids = await listComparisons(taskId);

  if (!ids.includes(id)) {
    return null;
  }

  const comparison = await loadComparison(taskId, id);

  const packet = comparison.manifest.packets.find(
    (entry) => entry.id === packetId && entry.reader.channel === "owner",
  );

  return packet ? { comparison, packet } : null;
}

/** Saves the owner's read of one packet as its own attempt; the engine grades its checks. */
export async function saveBlindReadAction(formData: FormData): Promise<BlindReadResult> {
  const taskId = identifier.safeParse(parseFormField(formData, "taskId"));
  const id = identifier.safeParse(parseFormField(formData, "comparisonId"));
  const packetId = parseFormField(formData, "packetId") ?? "";

  if (!taskId.success || !id.success) {
    return { error: "This comparison no longer exists." };
  }

  const found = await findOwnerPacket(taskId.data, id.data, packetId);

  if (!found) {
    return { error: "This read no longer exists." };
  }

  if (
    found.comparison.attempts.some((attempt) => attempt.packetId === packetId && attempt.passed)
  ) {
    return { error: "You’ve already read these pairs." };
  }

  const { packet } = found.packet;

  try {
    const saved = await importVerdicts({
      attempt: `owner-${Date.now()}`,
      id: id.data,
      packetId,
      response: { verdicts: packet.pairs.map((pair) => verdict(formData, pair, packet.criteria)) },
      taskId: taskId.data,
    });

    revalidatePath(readPath({ id: id.data, packetId, taskId: taskId.data }));
    revalidatePath(comparisonPath(taskId.data, id.data));
    revalidatePath(`/tasks/${taskId.data}`);

    return { failures: saved.failures, passed: saved.passed };
  } catch (error) {
    logError("Error saving a blind read:", error);
    return { error: "Your read couldn’t be saved. Check every pair has a choice, then try again." };
  }
}
