import { type RoadBand } from "@/components/public/plan-road";
import { daysBetween } from "./landing-examples";

/** A phase of an example plan, by its days: the road draws each as long as they are. */
export type ExamplePhase = { end: Date; id: string; name: string; start: Date };

/**
 * An example plan's phases as the road draws them on the examples' `today`: the ones over done, the
 * one today falls in current (its lessons done as far as its days went), the rest ahead with their
 * first day under them (`formatStart`). Every number comes from the phases' dates, so the road,
 * the countdown and a plan change's dates always agree.
 */
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

/** "Phase 2 of 4": where today is on the road, by its place. */
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
