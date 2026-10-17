import { type Citation } from "./blueprint-contract";
import { type FactEntry } from "./blueprint-fact-claims";

/** The claims both checks kept, by id, with their citations. */
export type KeptFacts = Map<string, Citation[]>;

export function toKeptFacts({
  facts,
  supportedIds,
}: {
  facts: FactEntry[];
  supportedIds: string[];
}): KeptFacts {
  const supported = new Set(supportedIds);

  return new Map(
    facts
      .filter((item) => item.found && supported.has(item.id))
      .map((item) => [item.id, item.citations]),
  );
}

/** A detail's value when its own claim was kept; otherwise a gap, never a guess. */
export function keptOr<T, TGap>({
  gap,
  id,
  kept,
  value,
}: {
  gap: TGap;
  id: string;
  kept: KeptFacts;
  value: T;
}): T | TGap {
  return kept.has(id) ? value : gap;
}
