type GraphNode = { key: string; phase: number; prerequisites: string[] };

function findFirstSubjectPhase<T extends GraphNode>({
  dependents,
  memo,
  node,
  supporting,
}: {
  dependents: ReadonlyMap<string, readonly T[]>;
  memo: Map<string, number>;
  node: T;
  supporting: ReadonlySet<string>;
}): number {
  if (!supporting.has(node.key)) {
    return node.phase;
  }

  const known = memo.get(node.key);

  if (known !== undefined) {
    return known;
  }

  const phase = Math.min(
    ...(dependents.get(node.key) ?? []).map((dependent) =>
      findFirstSubjectPhase({ dependents, memo, node: dependent, supporting }),
    ),
  );

  memo.set(node.key, phase);
  return phase;
}

export function orderSkillGraph<T extends GraphNode>({
  nodes,
  supporting,
}: {
  nodes: readonly T[];
  supporting: ReadonlySet<string>;
}): T[] {
  const phased = pushPhasesAfterPrerequisites(removeCycles(nodes));
  const dependents = new Map<string, T[]>();

  phased.forEach((node) => {
    node.prerequisites.forEach((key) =>
      dependents.set(key, [...(dependents.get(key) ?? []), node]),
    );
  });

  const memo = new Map<string, number>();

  const deferred = phased
    .filter((node) => supporting.has(node.key))
    .map((node) => {
      const phase = findFirstSubjectPhase({ dependents, memo, node, supporting });
      return { ...node, phase: phase === Infinity ? node.phase : phase };
    });

  const subjectFirst = [...phased.filter((node) => !supporting.has(node.key)), ...deferred];

  return sortSkillsTopologically(pushPhasesAfterPrerequisites(subjectFirst));
}

/** Walks skills in the order the model listed them, so the first path wins. */
export function removeCycles<T extends GraphNode>(nodes: readonly T[]): T[] {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const state = new Map<string, "visiting" | "done">();
  const kept = new Map<string, string[]>();

  const visit = (key: string): void => {
    state.set(key, "visiting");

    const prerequisites = (byKey.get(key)?.prerequisites ?? []).filter((prerequisite) => {
      if (state.get(prerequisite) === "visiting") {
        return false;
      }

      if (!state.has(prerequisite)) {
        visit(prerequisite);
      }

      return true;
    });

    kept.set(key, prerequisites);
    state.set(key, "done");
  };

  nodes.forEach((node) => {
    if (!state.has(node.key)) {
      visit(node.key);
    }
  });

  return nodes.map((node) => ({ ...node, prerequisites: kept.get(node.key) ?? [] }));
}

/** Expects a graph without cycles. */
export function pushPhasesAfterPrerequisites<T extends GraphNode>(nodes: readonly T[]): T[] {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const phases = new Map<string, number>();

  const getPhase = (key: string): number => {
    const known = phases.get(key);
    const node = byKey.get(key);

    if (known !== undefined || !node) {
      return known ?? 0;
    }

    const phase = Math.max(
      node.phase,
      ...node.prerequisites.map((prerequisite) => getPhase(prerequisite)),
    );

    phases.set(key, phase);

    return phase;
  };

  return nodes.map((node) => ({ ...node, phase: getPhase(node.key) }));
}

/** Expects a graph without cycles whose prerequisites never sit in a later phase. */
export function sortSkillsTopologically<T extends GraphNode>(nodes: readonly T[]): T[] {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const emitted = new Set<string>();
  const ordered: T[] = [];

  const emit = (node: T): void => {
    if (emitted.has(node.key)) {
      return;
    }

    emitted.add(node.key);

    node.prerequisites.forEach((prerequisite) => {
      const required = byKey.get(prerequisite);

      if (required) {
        emit(required);
      }
    });

    ordered.push(node);
  };

  nodes
    .map((node, index) => ({ index, node }))
    .toSorted((a, b) => a.node.phase - b.node.phase || a.index - b.index)
    .forEach(({ node }) => emit(node));

  return ordered;
}
