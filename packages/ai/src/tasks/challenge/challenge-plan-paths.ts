import { type ChallengePlan } from "./challenge-plan";

const MAX_PATH_STEPS = 5;

type PlanArrival = {
  id: string;
  from: string[];
  knownOnEveryPath: string[];
  knownOnSomePaths: string[];
};

function getPlanArrivals(plan: ChallengePlan): PlanArrival[] {
  const decisions = new Map(plan.decisions.map((decision) => [decision.id, decision]));
  const arrivals = new Map<string, { from: Set<string>; known: Set<string>[] }>();

  const visit = (id: string, known: ReadonlySet<string>, steps: number) => {
    const arrival = arrivals.get(id) ?? { from: new Set(), known: [] };
    arrivals.set(id, arrival);
    arrival.known.push(new Set(known));

    const decision = decisions.get(id);

    if (!decision || steps >= MAX_PATH_STEPS) {
      return;
    }

    for (const choice of decision.choices) {
      const next = arrivals.get(choice.next) ?? { from: new Set(), known: [] };
      arrivals.set(choice.next, next);
      next.from.add(`${id}.${choice.id}`);
      visit(choice.next, new Set([...known, ...choice.establishes]), steps + 1);
    }
  };

  visit(plan.startDecisionId, new Set(), 0);

  return [...arrivals].map(([id, { from, known }]) => {
    const everywhere = known.reduce((shared, path) => shared.intersection(path));
    const somewhere = known.reduce((all, path) => all.union(path));

    return {
      from: [...from],
      id,
      knownOnEveryPath: [...everywhere],
      knownOnSomePaths: [...somewhere.difference(everywhere)],
    };
  });
}

export function getPlanFactProblems(plan: ChallengePlan): string[] {
  const facts = new Set(plan.facts.map((fact) => fact.id));
  const arrivals = new Map(getPlanArrivals(plan).map((arrival) => [arrival.id, arrival]));

  const unknownEstablished = plan.decisions.flatMap((decision) =>
    decision.choices.flatMap((choice) =>
      choice.establishes
        .filter((id) => !facts.has(id))
        .map(
          (id) =>
            `Choice "${decision.id}.${choice.id}" establishes "${id}", which isn't in the facts`,
        ),
    ),
  );

  const endings = plan.endings.flatMap((ending) => {
    const known = new Set(arrivals.get(ending.id)?.knownOnEveryPath);

    return ending.restsOn.flatMap((id) => {
      if (!facts.has(id)) {
        return [`Ending "${ending.id}" rests on "${id}", which isn't in the facts`];
      }

      return plan.facts.some((fact) => fact.id === id && fact.known === "later") && !known.has(id)
        ? [
            `Ending "${ending.id}" rests on "${id}", but not every path that reaches it goes through a choice that establishes that fact: give those paths another ending, have every path establish it`,
          ]
        : [];
    });
  });

  return [...unknownEstablished, ...endings];
}

function formatFacts(ids: readonly string[]): string {
  return ids.length === 0 ? "none" : ids.join(", ");
}

function formatArrival(arrival: PlanArrival): string {
  if (arrival.from.length === 0) {
    return `- ${arrival.id}: the first decision`;
  }

  return [
    `- ${arrival.id}: reached by ${arrival.from.join(", ")}`,
    `  later facts known on every path: ${formatFacts(arrival.knownOnEveryPath)}`,
    `  later facts known on only some paths: ${formatFacts(arrival.knownOnSomePaths)}`,
  ].join("\n");
}

export function describePlanForScript(plan: ChallengePlan): string {
  const facts = plan.facts.map(({ derivation: _derivation, ...fact }) => fact);

  return [
    `PLAN:\n${JSON.stringify({ ...plan, facts }, null, 1)}`,
    `PATHS:\n${getPlanArrivals(plan)
      .map((arrival) => formatArrival(arrival))
      .join("\n")}`,
  ].join("\n");
}
