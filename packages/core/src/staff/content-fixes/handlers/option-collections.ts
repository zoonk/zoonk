import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { type StepKind } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type Json, toJson } from "../_utils/resolved-change";
import { screenContentProblem } from "./screens";

type ObjectValue = Record<string, Json>;
type GroupResult = { problem: string } | { mintedIds: string[]; removedIds: string[] };

function collections(kind: StepKind, content: ObjectValue): ObjectValue[] | null {
  if (
    kind === "check" ||
    kind === "multipleChoice" ||
    (kind === "hook" && content.variant === "guess")
  ) {
    return [content];
  }

  if (kind === "activity" && isJsonObject(content.check) && content.check.kind === "choice") {
    return [content.check];
  }

  if (
    kind === "challenge" &&
    Array.isArray(content.nodes) &&
    content.nodes.every((entry) => isJsonObject(entry))
  ) {
    return content.nodes;
  }

  return null;
}

function without(value: ObjectValue, key: string) {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
}

function optionProblem(
  option: ObjectValue,
  previous: ObjectValue[],
  allowedIds: readonly string[],
): string | null {
  const kept = previous.find((entry) => entry.id === option.id);

  if (!kept && (typeof option.id !== "string" || !allowedIds.includes(option.id))) {
    return "New options have no id; the server assigns one. Removed ids cannot be reused.";
  }

  return kept && !isDeepStrictEqual(without(kept, "isCorrect"), without(option, "isCorrect"))
    ? "A kept option keeps every field except isCorrect, including text, reason and picture."
    : null;
}

function optionArray(value: Json | undefined): ObjectValue[] | null {
  return Array.isArray(value) && value.every((entry) => isJsonObject(entry)) ? value : null;
}

function prepareGroup({
  previous,
  next,
  allowedIds,
  challenge,
}: {
  previous: ObjectValue[];
  next: ObjectValue[];
  allowedIds: readonly string[];
  challenge: boolean;
}): GroupResult {
  const mintedIds: string[] = [];

  for (const option of next) {
    if (option.id === undefined) {
      option.id = randomUUID();
      mintedIds.push(option.id);
    } else {
      const problem = optionProblem(option, previous, allowedIds);

      if (problem) {
        return { problem };
      }
    }
  }

  const ids = next.map((option) => option.id);

  if (new Set(ids).size !== ids.length) {
    return { problem: "Option ids must be unique." };
  }

  const added = next.some((option) => !previous.some((entry) => entry.id === option.id));

  if (added && allowedIds.length === 0 && [...previous, ...next].some((option) => option.picture)) {
    return {
      problem: "Adding picture options is not supported: every option needs a generated picture.",
    };
  }

  if (!challenge && next.filter((option) => option.isCorrect === true).length !== 1) {
    return { problem: "An option collection has exactly one correct answer." };
  }

  return {
    mintedIds,
    removedIds: previous.flatMap((option) =>
      typeof option.id === "string" && !ids.includes(option.id) ? [option.id] : [],
    ),
  };
}

function collectionsRemoved(kind: StepKind, content: ObjectValue) {
  const copy = structuredClone(content);

  for (const group of collections(kind, copy) ?? []) {
    group[kind === "challenge" ? "choices" : "options"] = [];
  }

  return copy;
}

export function prepareOptions(
  kind: StepKind,
  before: Json,
  sent: Json,
  allowedIds: readonly string[],
) {
  const after = structuredClone(sent);

  if (!isJsonObject(before) || !isJsonObject(after)) {
    return { problem: "Send the whole screen content." };
  }

  const oldGroups = collections(kind, before);
  const nextGroups = collections(kind, after);

  if (!oldGroups || !nextGroups || oldGroups.length !== nextGroups.length) {
    return {
      problem:
        "setOptions requires a hook guess, check, multipleChoice, activity choice or challenge.",
    };
  }

  const key = kind === "challenge" ? "choices" : "options";
  const mintedIds: string[] = [];
  const removedIds: string[] = [];

  for (const [index, group] of nextGroups.entries()) {
    const previous = optionArray(oldGroups[index]?.[key]);
    const next = optionArray(group[key]);

    if (!previous || !next) {
      return { problem: "Each option collection must be an array of options." };
    }

    const result = prepareGroup({ allowedIds, challenge: kind === "challenge", next, previous });

    if ("problem" in result) {
      return result;
    }

    mintedIds.push(...result.mintedIds);
    removedIds.push(...result.removedIds);
  }

  if (!isDeepStrictEqual(collectionsRemoved(kind, before), collectionsRemoved(kind, after))) {
    return {
      problem:
        "setOptions changes only the option collections; keep the rest of the screen unchanged.",
    };
  }

  const problem = screenContentProblem({ content: after, kind });
  return problem ? { problem } : { after: toJson(after), mintedIds, removedIds };
}
