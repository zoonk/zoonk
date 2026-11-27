import { ensureSecondTake } from "@zoonk/core/library/second-takes/ensure";

export async function ensureSecondTakeStep(input: Parameters<typeof ensureSecondTake>[0]) {
  "use step";

  return ensureSecondTake(input);
}
