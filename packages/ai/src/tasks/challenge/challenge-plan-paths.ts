import { type ChallengePlan } from "./challenge-plan";

const MAX_PATH_STEPS = 5;

type PlanArrival = {
  id: string;
  from: string[];
  hasVisualOnEveryPath: boolean;
  knownOnEveryPath: string[];
  knownOnSomePaths: string[];
};

type ArrivalPaths = { from: Set<string>; known: Set<string>[]; withoutVisual: boolean };

function emptyArrival(): ArrivalPaths {
  return { from: new Set(), known: [], withoutVisual: false };
}

function getPlanArrivals(plan: ChallengePlan): PlanArrival[] {
  const decisions = new Map(plan.decisions.map((decision) => [decision.id, decision]));
  const visualIds = new Set(plan.visuals.map((entry) => entry.id));
  const arrivals = new Map<string, ArrivalPaths>();

  const visit = ({
    id,
    known,
    shown,
    steps,
  }: {
    id: string;
    known: ReadonlySet<string>;
    shown: boolean;
    steps: number;
  }) => {
    const arrival = arrivals.get(id) ?? emptyArrival();
    arrivals.set(id, arrival);
    arrival.known.push(new Set(known));

    const decision = decisions.get(id);

    const hasVisual =
      shown ||
      (decision !== undefined && decision.visual !== null && visualIds.has(decision.visual));

    arrival.withoutVisual ||= !hasVisual;

    if (!decision || steps >= MAX_PATH_STEPS) {
      return;
    }

    for (const choice of decision.choices) {
      const next = arrivals.get(choice.next) ?? emptyArrival();
      arrivals.set(choice.next, next);
      next.from.add(`${id}.${choice.id}`);

      visit({
        id: choice.next,
        known: new Set([...known, ...choice.establishes]),
        shown: hasVisual,
        steps: steps + 1,
      });
    }
  };

  visit({ id: plan.startDecisionId, known: new Set(), shown: false, steps: 0 });

  return [...arrivals].map(([id, { from, known, withoutVisual }]) => {
    const everywhere = known.reduce((shared, path) => shared.intersection(path));
    const somewhere = known.reduce((all, path) => all.union(path));

    return {
      from: [...from],
      hasVisualOnEveryPath: !withoutVisual,
      id,
      knownOnEveryPath: [...everywhere],
      knownOnSomePaths: [...somewhere.difference(everywhere)],
    };
  });
}

function getVisualProblems({
  arrivals,
  plan,
}: {
  arrivals: ReadonlyMap<string, PlanArrival>;
  plan: ChallengePlan;
}): string[] {
  const visuals = new Map(plan.visuals.map((entry) => [entry.id, entry]));
  const shown = new Map(plan.decisions.map((decision) => [decision.id, decision.visual]));
  const used = new Set(shown.values());

  const ledgerProblems = plan.visuals.flatMap((entry) => [
    !used.has(entry.id) && `No decision shows visual "${entry.id}".`,
    entry.known === "start" &&
      shown.get(plan.startDecisionId) !== entry.id &&
      `Visual "${entry.id}" is known at the start: show it on the first decision.`,
  ]);

  const decisionProblems = plan.decisions.flatMap((decision) => {
    const entry = decision.visual === null ? undefined : visuals.get(decision.visual);
    const known = arrivals.get(decision.id)?.knownOnEveryPath;

    return [
      decision.visual !== null &&
        !entry &&
        `Decision "${decision.id}" shows unknown visual "${decision.visual}".`,
      entry?.known === "later" &&
        !known?.includes(entry.id) &&
        `Decision "${decision.id}" shows visual "${entry.id}", but a route into it hasn't established the visual.`,
      ...decision.choices.flatMap((choice) =>
        choice.establishes
          .filter((id) => visuals.has(id) && shown.get(choice.next) !== id)
          .map(
            (id) =>
              `Choice "${decision.id}.${choice.id}" establishes visual "${id}": show it on the next decision.`,
          ),
      ),
    ];
  });

  const endingProblems = plan.endings.map(
    (ending) =>
      visuals.size > 0 &&
      arrivals.get(ending.id)?.hasVisualOnEveryPath === false &&
      `A path to ending "${ending.id}" skips every chart: include a decision with a chart on that path.`,
  );

  return [...ledgerProblems, ...decisionProblems, ...endingProblems].filter(
    (problem) => typeof problem === "string",
  );
}

export function getPlanFactProblems(plan: ChallengePlan): string[] {
  const entries = [...plan.facts, ...plan.visuals];
  const ledger = new Map(entries.map((entry) => [entry.id, entry.known]));
  const ids = entries.map((entry) => entry.id);
  const duplicates = new Set(ids.filter((id, index) => ids.indexOf(id) !== index));
  const arrivals = new Map(getPlanArrivals(plan).map((arrival) => [arrival.id, arrival]));

  const unknownEstablished = plan.decisions.flatMap((decision) =>
    decision.choices.flatMap((choice) =>
      choice.establishes
        .filter((id) => !ledger.has(id))
        .map(
          (id) =>
            `Choice "${decision.id}.${choice.id}" establishes "${id}", which isn't in the facts or visuals`,
        ),
    ),
  );

  const endings = plan.endings.flatMap((ending) => {
    const known = new Set(arrivals.get(ending.id)?.knownOnEveryPath);

    return ending.restsOn.flatMap((id) => {
      if (!ledger.has(id)) {
        return [`Ending "${ending.id}" rests on "${id}", which isn't in the facts or visuals`];
      }

      return ledger.get(id) === "later" && !known.has(id)
        ? [
            `Ending "${ending.id}" rests on "${id}", but not every path that reaches it goes through a choice that establishes it: give those paths another ending, have every path establish it`,
          ]
        : [];
    });
  });

  return [
    ...[...duplicates].map(
      (id) => `Facts and visuals share one id namespace: "${id}" is used more than once.`,
    ),
    ...unknownEstablished,
    ...endings,
    ...getVisualProblems({ arrivals, plan }),
  ];
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
    `  later facts and visuals known on every path: ${formatFacts(arrival.knownOnEveryPath)}`,
    `  later facts and visuals known on only some paths: ${formatFacts(arrival.knownOnSomePaths)}`,
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
