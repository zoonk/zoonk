import { type DimensionInventory } from "../../player-reducer";

type HeaderDimensionState =
  | { count: number; kind: "at-risk" }
  | { count: number; kind: "negative" }
  | { kind: "all-clear" };

export function getHeaderDimensionState(dimensions: DimensionInventory): HeaderDimensionState {
  const values = Object.values(dimensions);
  const negativeCount = values.filter((value) => value < 0).length;

  if (negativeCount > 0) {
    return { count: negativeCount, kind: "negative" };
  }

  const atRiskCount = values.filter((value) => value === 0).length;

  if (atRiskCount > 0) {
    return { count: atRiskCount, kind: "at-risk" };
  }

  return { kind: "all-clear" };
}

export function getStatusColor(kind: HeaderDimensionState["kind"]): string {
  if (kind === "negative") {
    return "text-destructive";
  }
  if (kind === "at-risk") {
    return "text-warning";
  }
  return "text-muted-foreground";
}
