import { createHash } from "node:crypto";

/** Deterministic namespaced UUID used only for idempotency, never as an authorization token. */
export function stableLearningId(value: unknown): string {
  const digest = createHash("sha256").update(JSON.stringify(value)).digest("hex");

  return digest.replace(
    /^(?<first>.{8})(?<second>.{4}).(?<third>.{3}).(?<fourth>.{3})(?<last>.{12}).*$/u,
    "$<first>-$<second>-5$<third>-a$<fourth>-$<last>",
  );
}
