import { recordTestOutChange } from "@zoonk/core/plans/record-test-out-change";

export async function recordTestOutChangeStep(input: Parameters<typeof recordTestOutChange>[0]) {
  "use step";

  await recordTestOutChange(input);
}
