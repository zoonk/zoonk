import { type RoadBand } from "@/components/public/plan-road";
import { daysBetween } from "./landing-examples";

export type ExamplePhase = { end: Date; id: string; name: string; start: Date };

export function getRoadBands({
  formatStart,
  phases,
  today,
}: {
  formatStart: (date: Date) => string;
  phases: readonly ExamplePhase[];
  today: Date;
}): RoadBand[] {
  return phases.map((phase) => {
    const weight = daysBetween({ from: phase.start, to: phase.end }) + 1;
    const base = { id: phase.id, name: phase.name, weight };

    if (phase.end < today) {
      return { ...base, state: "done" };
    }

    if (phase.start > today) {
      return { ...base, startLabel: formatStart(phase.start), state: "upcoming" };
    }

    const share = daysBetween({ from: phase.start, to: today }) / weight;
    return { ...base, share, state: "current", todayShare: share };
  });
}

export function getCurrentPhase({
  phases,
  today,
}: {
  phases: readonly ExamplePhase[];
  today: Date;
}) {
  const index = phases.findIndex((phase) => phase.start <= today && phase.end >= today);

  return { name: phases[index]?.name ?? "", number: index + 1, total: phases.length };
}
