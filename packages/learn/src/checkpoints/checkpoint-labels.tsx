"use client";

import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { useExtracted } from "next-intl";

/** A duel's one name, the same on its row, its header and its result. */
export function useChallengeName(checkpoint: Pick<CheckpointView, "kind">): string {
  const t = useExtracted();
  return checkpoint.kind === "weekly" ? t("Weekly challenge") : t("The Trickster");
}
