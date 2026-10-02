type GraphNode = { key: string; phase: number; prerequisites: string[] };

/**
 * Drops each prerequisite edge that would close a cycle, walking skills in the
 * order the model listed them, so the first path wins and every skill can
 * still be scheduled after its prerequisites.
 */
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

/**
 * Moves a skill to a later phase when one of its prerequisites sits in a later
 * phase, so no phase asks for something the learner hasn't reached yet.
 * Expects a graph without cycles.
 */
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

/**
 * Orders skills by phase and keeps the model's order inside a phase, pulling
 * each prerequisite in front of the skills that need it. Expects a graph
 * without cycles whose prerequisites never sit in a later phase.
 */
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
