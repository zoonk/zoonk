import { type NumericDomain, niceTicks } from "@zoonk/utils/plot-scale";

export function chartReaderTicks({ domain }: { domain: NumericDomain; label: string }): number[] {
  return niceTicks(domain, 3);
}
